import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, interval } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { BridgeStatus, WhatsAppChannelStatus } from '../../../core/models/platform-whatsapp-provider.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppBridgeService } from '../../../core/services/platform-whatsapp-bridge.service';

/** How a status reads to an operator. The wording follows the bridge's own state, never "connected" before the bridge says so. */
const LABELS: Record<BridgeStatus, string> = {
  NotConnected: 'Not connected',
  ConnectionInitiated: 'Connection started',
  QrCodeAvailable: 'Scan the QR code',
  AwaitingAuthentication: 'Waiting for the scan to finish',
  Connected: 'Connected',
  Disconnected: 'Disconnected',
  Reconnecting: 'Reconnecting',
  ConnectionFailed: 'Connection failed',
  Disabled: 'Disabled',
};

const PAIRING: BridgeStatus[] = ['ConnectionInitiated', 'QrCodeAvailable', 'AwaitingAuthentication'];

/**
 * One tenant's QR-code WhatsApp connection, shown in place on the tenant page (the QR appears right here, nothing navigates away).
 * Success is whatever the BRIDGE reports: showing or scanning a code never marks the tenant connected, so the card polls the status and only
 * turns green when the API says Connected. The QR rotates about every 45 seconds, so while pairing the card asks for a fresh one a little
 * sooner. A QR is kept only in this component's memory and dropped as soon as pairing ends.
 */
@Component({
  selector: 'app-platform-tenant-qr-channel',
  templateUrl: './platform-tenant-qr-channel.component.html',
  styleUrls: ['./platform-tenant-qr-channel.component.scss'],
})
export class PlatformTenantQrChannelComponent implements OnInit, OnDestroy {
  @Input() tenantId = '';

  channel: WhatsAppChannelStatus | null = null;
  qr: string | null = null;
  loading = true;
  busy = false;
  loadFailed = false;
  error: string | null = null;
  confirmingRemove = false;

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly bridge: PlatformWhatsAppBridgeService, private readonly notify: NotificationService) {}

  ngOnInit(): void {
    this.refresh(true);
    // Status poll: cheap, and only does anything while there is something to wait for.
    interval(3000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.pairing || this.channel?.status === 'Reconnecting') {
          this.refresh(false);
        }
      });
    // The bridge rotates the code; ask for a fresh one a little before it would expire.
    interval(40000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.pairing && this.qr && !this.busy) {
          this.connect(false);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get label(): string {
    return this.channel ? LABELS[this.channel.status] ?? this.channel.status : '';
  }

  get pairing(): boolean {
    return !!this.channel && PAIRING.includes(this.channel.status);
  }

  get connected(): boolean {
    return this.channel?.status === 'Connected';
  }

  get canConnect(): boolean {
    return !this.connected && !this.busy;
  }

  refresh(initial: boolean): void {
    this.bridge
      .getStatus(this.tenantId)
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (status) => {
          this.loadFailed = false;
          this.apply(status, false);
        },
        error: (err) => {
          if (initial) {
            this.loadFailed = true;
          }
          this.error = this.messageOf(err);
        },
      });
  }

  connect(announce = true): void {
    this.busy = true;
    this.error = null;
    this.bridge
      .connect(this.tenantId)
      .pipe(
        finalize(() => (this.busy = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (status) => {
          this.apply(status, true);
          if (announce && !status.qrBase64 && status.status !== 'Connected') {
            this.notify.error('The bridge did not return a QR code. Try again.');
          }
        },
        error: (err) => (this.error = this.messageOf(err)),
      });
  }

  disconnect(): void {
    this.busy = true;
    this.error = null;
    this.bridge
      .disconnect(this.tenantId)
      .pipe(
        finalize(() => (this.busy = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (status) => {
          this.apply(status, false);
          if (status.confirmed) {
            this.notify.success('Disconnected.');
          }
        },
        error: (err) => (this.error = this.messageOf(err)),
      });
  }

  askRemove(): void {
    this.confirmingRemove = true;
  }

  cancelRemove(): void {
    this.confirmingRemove = false;
  }

  remove(): void {
    this.confirmingRemove = false;
    this.busy = true;
    this.error = null;
    this.bridge
      .remove(this.tenantId)
      .pipe(
        finalize(() => (this.busy = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (status) => {
          this.apply(status, false);
          if (status.confirmed) {
            this.notify.success('QR connection removed.');
          }
        },
        error: (err) => (this.error = this.messageOf(err)),
      });
  }

  /** `fromConnect`: only a connect response carries a QR; a status poll must not wipe the one on screen. */
  private apply(status: WhatsAppChannelStatus, fromConnect: boolean): void {
    this.channel = status;
    if (fromConnect && status.qrBase64) {
      this.qr = status.qrBase64;
    }
    // Pairing is over (connected, or back to nothing): the code is no longer needed and is dropped.
    if (!PAIRING.includes(status.status)) {
      this.qr = null;
    }
    if (status.status === 'Connected') {
      this.confirmingRemove = false;
    }
  }

  private messageOf(err: unknown): string {
    const e = err as HttpErrorResponse;
    return e?.error?.detail || e?.error?.title || 'The bridge could not be reached.';
  }
}

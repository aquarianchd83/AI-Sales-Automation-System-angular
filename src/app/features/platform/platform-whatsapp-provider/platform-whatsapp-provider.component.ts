import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { WhatsAppBridgeSettings, WhatsAppProviderSettings } from '../../../core/models/platform-whatsapp-provider.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppBridgeService } from '../../../core/services/platform-whatsapp-bridge.service';
import { PlatformWhatsAppProviderService } from '../../../core/services/platform-whatsapp-provider.service';

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * The Platform Admin Console's WhatsApp provider selector: which integration the platform offers tenants, plus the connection to the
 * self-hosted QR bridge. The bridge cannot be chosen until it is configured and answers with the saved key - the server checks that, and
 * this screen disables the option until then. The bridge key is write-only: a blank field keeps the stored one.
 */
@Component({
  selector: 'app-platform-whatsapp-provider',
  templateUrl: './platform-whatsapp-provider.component.html',
  styleUrls: ['./platform-whatsapp-provider.component.scss'],
})
export class PlatformWhatsAppProviderComponent implements OnInit {
  current: WhatsAppProviderSettings | null = null;
  /** What the radio currently shows; differs from `current.active` until saved. */
  selected = '';
  loading = true;
  loadFailed = false;
  saving = false;

  bridge: WhatsAppBridgeSettings | null = null;
  savingBridge = false;
  bridgeError: string | null = null;

  readonly bridgeForm = this.fb.group({
    baseUrl: ['', [Validators.pattern(/^https?:\/\/\S+$/i)]],
    apiKey: '',
    webhookBaseUrl: ['', [Validators.pattern(/^https?:\/\/\S+$/i)]],
    /** One tenant id per line or comma-separated. Empty: every tenant. */
    pilotTenantIds: '',
  });

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly providers: PlatformWhatsAppProviderService,
    private readonly bridgeService: PlatformWhatsAppBridgeService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadBridge();
  }

  get pristine(): boolean {
    return !this.current || this.selected === this.current.active;
  }

  get activeName(): string {
    return this.current?.providers.find((p) => p.id === this.current?.active)?.name ?? this.current?.active ?? '';
  }

  /** The tenant ids in the pilot box, or null when one of them is not a valid id. */
  get pilotIds(): string[] | null {
    const parts = (this.bridgeForm.controls.pilotTenantIds.value || '')
      .split(/[\s,;]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return parts.every((p) => GUID.test(p)) ? parts : null;
  }

  get bridgeInvalid(): boolean {
    return this.bridgeForm.invalid || this.pilotIds === null;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.providers
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (settings) => this.apply(settings),
        error: () => (this.loadFailed = true),
      });
  }

  save(): void {
    if (this.pristine || this.saving) {
      return;
    }
    this.saving = true;
    this.providers
      .save(this.selected)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (settings) => {
          this.apply(settings);
          this.notify.success(`WhatsApp provider is now ${this.activeName}.`);
        },
        // The server kept the previous provider, so put the radio back to what is really active.
        error: (err) => {
          this.selected = this.current?.active ?? '';
          this.notify.error(this.messageOf(err) ?? 'The WhatsApp provider was not changed.');
        },
      });
  }

  discard(): void {
    this.selected = this.current?.active ?? '';
  }

  loadBridge(): void {
    this.bridgeService.getSettings().subscribe({
      next: (settings) => this.applyBridge(settings),
      error: () => (this.bridgeError = 'The bridge settings could not be loaded.'),
    });
  }

  saveBridge(): void {
    const pilots = this.pilotIds;
    if (this.bridgeForm.invalid || pilots === null || this.savingBridge) {
      return;
    }
    const value = this.bridgeForm.getRawValue();
    this.savingBridge = true;
    this.bridgeError = null;
    this.bridgeService
      .saveSettings({
        baseUrl: value.baseUrl.trim(),
        // Blank keeps the stored key; the server never sends it back.
        apiKey: value.apiKey.trim().length === 0 ? null : value.apiKey.trim(),
        webhookBaseUrl: value.webhookBaseUrl.trim(),
        pilotTenantIds: pilots,
      })
      .pipe(finalize(() => (this.savingBridge = false)))
      .subscribe({
        next: (settings) => {
          this.applyBridge(settings);
          this.notify.success('Bridge settings saved.');
          // The bridge option becomes selectable once it is configured.
          this.load();
        },
        error: (err) => (this.bridgeError = this.messageOf(err) ?? 'The bridge settings were not saved.'),
      });
  }

  private apply(settings: WhatsAppProviderSettings): void {
    this.current = settings;
    this.selected = settings.active;
  }

  private applyBridge(settings: WhatsAppBridgeSettings): void {
    this.bridge = settings;
    this.bridgeForm.reset({
      baseUrl: settings.baseUrl,
      apiKey: '',
      webhookBaseUrl: settings.webhookBaseUrl,
      pilotTenantIds: settings.pilotTenantIds.join('\n'),
    });
  }

  /** The first validation message the server sent, if any. */
  private messageOf(err: unknown): string | null {
    const e = err as HttpErrorResponse;
    const errors = e?.error?.errors as Record<string, string[]> | undefined;
    const first = errors ? Object.values(errors).flat()[0] : undefined;
    return first ?? e?.error?.detail ?? e?.error?.title ?? null;
  }
}

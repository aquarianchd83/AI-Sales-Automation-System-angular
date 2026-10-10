import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { MetaIssue, MetaIssueAction, MetaSignupClientConfig, MetaSignupResult, MetaSignupStep } from '../../../core/models/meta-signup.model';
import { TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { MetaSignupService } from '../../../core/services/meta-signup.service';
import { NotificationService } from '../../../core/services/notification.service';

/** Where a tenant finishes a verification Meta asks for (business verification, number verification, account status). */
export const META_BUSINESS_SETTINGS_URL = 'https://business.facebook.com/settings/security';

/**
 * The "Connect with Meta" card: one button that takes the tenant through Meta's own sign-in and then sets WhatsApp up for them -
 * no ids, tokens or webhook settings to find or paste. Shows each step's status, and when Meta blocks one, a plain-language
 * explanation with the next action (never Meta's raw error). Steps already done stay done: Retry resumes from the first one not.
 *
 * Used on the tenant's Settings page, which is also the onboarding wizard's WhatsApp step.
 */
@Component({
  selector: 'app-meta-connect-card',
  templateUrl: './meta-connect-card.component.html',
  styleUrls: ['./meta-connect-card.component.scss'],
})
export class MetaConnectCardComponent implements OnInit {
  /** The saved connection, if any (null: not connected yet). */
  @Input() config: TenantWhatsAppConfig | null = null;
  /** The number the tenant entered, shown so they know which one to pick in Meta's window. */
  @Input() phoneNumber: string | null = null;
  /** After a sign-in or a retry: the connection as it stands now. */
  @Output() changed = new EventEmitter<TenantWhatsAppConfig>();

  readonly metaSettingsUrl = META_BUSINESS_SETTINGS_URL;

  clientConfig: MetaSignupClientConfig | null = null;
  result: MetaSignupResult | null = null;
  /** Set when the card itself cannot talk to Meta (the sign-in script did not load). */
  localIssue: MetaIssue | null = null;
  working: 'connect' | 'resume' | 'status' | null = null;

  constructor(private readonly signup: MetaSignupService, private readonly notify: NotificationService) {}

  ngOnInit(): void {
    this.signup.getConfig().subscribe({
      next: (c) => (this.clientConfig = c),
      error: () => undefined, // the error interceptor shows why
    });
    if (this.config?.isConnected) {
      this.working = 'status';
      this.signup
        .getStatus()
        .pipe(finalize(() => (this.working = null)))
        .subscribe({ next: (r) => this.apply(r, false), error: () => undefined });
    }
  }

  get connected(): boolean {
    return !!this.config?.isConnected;
  }

  get busy(): boolean {
    return this.working !== null;
  }

  /** The button is off only while something is running or the platform has not set Meta up. */
  get canConnect(): boolean {
    return !this.busy && !!this.clientConfig?.enabled;
  }

  /** Active only when Meta has confirmed every step messaging depends on. */
  get active(): boolean {
    return this.result?.status === 'Completed' && !!this.config?.verifiedAtUtc;
  }

  get issue(): MetaIssue | null {
    return this.localIssue ?? this.result?.issue ?? this.clientConfig?.issue ?? null;
  }

  get steps(): MetaSignupStep[] {
    return this.result?.steps ?? [];
  }

  connect(): void {
    if (!this.canConnect || !this.clientConfig) {
      return;
    }
    this.localIssue = null;
    this.working = 'connect';
    this.signup
      .launch(this.clientConfig)
      .then(
        (outcome) => {
          this.signup
            .complete(outcome)
            .pipe(finalize(() => (this.working = null)))
            .subscribe({ next: (r) => this.apply(r, true), error: () => undefined });
        },
        () => {
          this.working = null;
          this.localIssue = {
            code: 'sdk_unavailable',
            step: 'authorization',
            title: 'Meta sign-in could not open',
            message:
              'The Meta sign-in window could not be loaded. Check your internet connection and that nothing is blocking facebook.com, then try again.',
            primaryAction: 'Retry',
            secondaryAction: null,
            retryable: true,
            reference: null,
          };
        }
      );
  }

  /** Retry: from the first step not done when the connection is saved, otherwise a fresh sign-in. */
  retry(): void {
    if (this.busy) {
      return;
    }
    if (!this.connected) {
      this.connect();
      return;
    }
    this.localIssue = null;
    this.working = 'resume';
    this.signup
      .resume()
      .pipe(finalize(() => (this.working = null)))
      .subscribe({ next: (r) => this.apply(r, true), error: () => undefined });
  }

  run(action: MetaIssueAction | null): void {
    if (action === 'Retry') {
      this.retry();
    } else if (action === 'Reconnect') {
      this.connect();
    }
  }

  actionLabel(action: MetaIssueAction | null): string {
    switch (action) {
      case 'Retry':
        return 'Retry';
      case 'Reconnect':
        return 'Reconnect with Meta';
      case 'Verify':
        return 'Open Meta Business settings';
      case 'AddCredits':
        return 'Add credits';
      default:
        return '';
    }
  }

  stepIcon(step: MetaSignupStep): string {
    switch (step.status) {
      case 'Completed':
        return 'check_circle';
      case 'ActionRequired':
        return 'error_outline';
      case 'Failed':
        return 'cancel';
      case 'InProgress':
        return 'autorenew';
      default:
        return 'radio_button_unchecked';
    }
  }

  statusLabel(step: MetaSignupStep): string {
    switch (step.status) {
      case 'Completed':
        return 'Completed';
      case 'ActionRequired':
        return 'Action required';
      case 'Failed':
        return 'Failed';
      case 'InProgress':
        return 'In progress';
      default:
        return 'Not started';
    }
  }

  private apply(result: MetaSignupResult, announce: boolean): void {
    this.result = result;
    if (result.config) {
      this.config = result.config;
      this.changed.emit(result.config);
    }
    if (announce && result.status === 'Completed') {
      this.notify.success('WhatsApp is connected.');
    }
  }
}

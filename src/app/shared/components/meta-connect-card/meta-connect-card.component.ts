import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { MetaIssue, MetaIssueAction, MetaSignupClientConfig, MetaSignupResult, MetaSignupStep } from '../../../core/models/meta-signup.model';
import { TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { MetaSignupService, MetaSignupTimeoutError } from '../../../core/services/meta-signup.service';
import { NotificationService } from '../../../core/services/notification.service';

/** Where a tenant finishes a verification Meta asks for (business verification, number verification, account status). */
export const META_BUSINESS_SETTINGS_URL = 'https://business.facebook.com/settings/security';

/** What each setup step means, in words a non-technical person can follow. */
const STEP_HELP: Record<string, string> = {
  authorization: 'You sign in to Meta and allow access.',
  assets: "You choose or add your WhatsApp number in Meta's window.",
  credentials: 'We keep the access safe on our servers.',
  registration: 'Your number is switched on for messaging.',
  webhook: 'Customer replies reach this app.',
  templates: 'Pre-approved messages you can send in campaigns.',
  verification: 'Meta confirms that everything works.',
};

/** The one badge at the top of the card. */
export type ConnectState = 'unavailable' | 'active' | 'attention' | 'connected' | 'idle';

/**
 * The "Connect with Meta" card: one button that takes the tenant through Meta's own sign-in - the tenant picks or adds their WhatsApp
 * number there - and then sets WhatsApp up for them: no ids, tokens, webhook settings or number to type. Shows each step's status, and
 * when Meta blocks one, a plain-language explanation of what happened and what to do next (never Meta's raw error). Steps already done
 * stay done: Retry resumes from the first one not.
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

  /** The platform has not finished setting up its Meta app (known once the config has loaded). The tenant can do nothing about it. */
  get unavailable(): boolean {
    return !!this.clientConfig && !this.clientConfig.enabled;
  }

  /** What went wrong on this connection. The platform-not-ready case is `unavailable`, shown on its own so it never hides this. */
  get issue(): MetaIssue | null {
    return this.localIssue ?? this.result?.issue ?? null;
  }

  /** The one button reads "Reconnect" whenever a connection exists or Meta asked for a new sign-in. */
  get reconnect(): boolean {
    return this.connected || this.issue?.primaryAction === 'Reconnect' || this.issue?.secondaryAction === 'Reconnect';
  }

  /** What the badge says: the platform not ready, a working connection, a blocked step, a saved-but-unchecked one, or nothing yet. */
  get state(): ConnectState {
    if (this.unavailable) {
      return 'unavailable';
    }
    if (this.active) {
      return 'active';
    }
    if (this.issue || this.steps.some((s) => s.status === 'ActionRequired' || s.status === 'Failed')) {
      return 'attention';
    }
    return this.connected ? 'connected' : 'idle';
  }

  get stateLabel(): string {
    switch (this.state) {
      case 'unavailable':
        return 'Not available yet';
      case 'active':
        return 'Connected';
      case 'attention':
        return 'Needs attention';
      case 'connected':
        return this.working === 'status' ? 'Checking…' : 'Connected';
      default:
        return 'Not connected';
    }
  }

  /** The number Meta confirmed, once there is one. */
  get connectedNumber(): string | null {
    return this.config?.verifiedDisplayPhoneNumber || null;
  }

  /** The step Meta stopped at, by its title. */
  get blockedStepTitle(): string | null {
    const key = this.issue?.step;
    return this.steps.find((s) => s.key === key)?.title ?? null;
  }

  /** What to do about the issue, in one sentence. */
  nextStep(issue: MetaIssue): string {
    switch (issue.primaryAction) {
      case 'Reconnect':
        return 'Press "Reconnect with Meta" and approve everything Meta asks for. What is already set up is kept.';
      case 'Retry':
        return 'Your progress is saved. Press "Retry" and it carries on from this step.';
      case 'Verify':
        return 'Finish the check in your Meta Business settings, then come back and press "Retry".';
      case 'AddCredits':
        return 'Add credits to your wallet, then come back and press "Retry".';
      case 'ContactSupport':
        return 'Please contact support and quote the reference below.';
      default:
        return '';
    }
  }

  stepHelp(step: MetaSignupStep): string {
    return STEP_HELP[step.key] ?? '';
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
        (error) => {
          this.working = null;
          if (error instanceof MetaSignupTimeoutError) {
            this.localIssue = {
              code: 'signup_timeout',
              step: 'authorization',
              title: 'Meta did not finish the sign-up',
              message:
                "Meta's sign-up window did not report back, so nothing was connected. This usually means Meta has not yet approved this app to onboard customers " +
                '(for example the business is not verified, or WhatsApp access is not approved). Close the Meta window and try again; if it keeps happening, ' +
                'contact support.',
              primaryAction: 'Retry',
              secondaryAction: null,
              retryable: true,
              reference: null,
            };
            return;
          }
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

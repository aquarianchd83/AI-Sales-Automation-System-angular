import { Component } from '@angular/core';
import { finalize } from 'rxjs/operators';

import {
  DeliveryStatus,
  NOTIFICATION_KIND_LABELS,
  QUOTA_TYPE_LABELS,
  QuotaType,
  SendTestNotificationRequest,
  TEST_NOTIFICATION_KINDS,
  TenantNotification,
  TenantNotificationKind,
  notificationKindNeedsQuotaType,
} from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';

/** Lets a tenant Admin fire a real test of any billing alert (quota, credits, refund, plan) through
 * the exact same delivery path a genuine one would use — in-app, email and WhatsApp — instead of
 * waiting for the real trigger to happen on its own. Admin only, same gate as the rest of Billing. */
@Component({
  selector: 'app-test-notifications',
  templateUrl: './test-notifications.component.html',
  styleUrls: ['./test-notifications.component.scss'],
})
export class TestNotificationsComponent {
  readonly kinds = TEST_NOTIFICATION_KINDS;
  readonly kindLabels = NOTIFICATION_KIND_LABELS;
  readonly quotaTypeOptions = [QuotaType.LeadCandidates, QuotaType.WhatsAppMessages, QuotaType.AiConversations];
  readonly quotaTypeLabels = QUOTA_TYPE_LABELS;
  readonly needsQuotaType = notificationKindNeedsQuotaType;
  readonly DeliveryStatus = DeliveryStatus;

  /** One quota-type choice per quota-threshold kind, so switching kinds doesn't lose the others'. */
  quotaTypeByKind: Partial<Record<TenantNotificationKind, QuotaType>> = Object.fromEntries(
    this.kinds.filter((k) => this.needsQuotaType(k)).map((k) => [k, QuotaType.LeadCandidates])
  );

  /** Kinds a send is currently in flight for — disables just that row's button. */
  readonly sending = new Set<TenantNotificationKind>();

  /** The most recent test result per kind, so its delivery status stays visible until sent again. */
  lastResult: Partial<Record<TenantNotificationKind, TenantNotification>> = {};

  constructor(
    private readonly billing: BillingService,
    private readonly notify: NotificationService
  ) {}

  send(kind: TenantNotificationKind): void {
    if (this.sending.has(kind)) {
      return;
    }
    const request: SendTestNotificationRequest = {
      kind,
      quotaType: this.needsQuotaType(kind) ? this.quotaTypeByKind[kind] ?? QuotaType.LeadCandidates : null,
    };

    this.sending.add(kind);
    this.billing
      .sendTestNotification(request)
      .pipe(finalize(() => this.sending.delete(kind)))
      .subscribe({
        next: (result) => {
          this.lastResult = { ...this.lastResult, [kind]: result };
          this.notify.success('Test alert sent — check the bell, the banner if it\'s urgent, and your email/WhatsApp.');
        },
        error: (err) => {
          const message = err?.error?.message || err?.error?.detail || 'Could not send the test alert.';
          this.notify.error(message);
        },
      });
  }

  deliveryLabel(status: DeliveryStatus): string {
    switch (status) {
      case DeliveryStatus.Sent:
        return 'Sent';
      case DeliveryStatus.Failed:
        return 'Failed';
      case DeliveryStatus.Skipped:
        return 'Skipped';
      default:
        return 'Not attempted';
    }
  }

  deliveryChipClass(status: DeliveryStatus): string {
    switch (status) {
      case DeliveryStatus.Sent:
        return 'status-chip status-chip--running';
      case DeliveryStatus.Failed:
        return 'status-chip status-chip--stopped';
      default:
        return 'status-chip status-chip--draft';
    }
  }
}

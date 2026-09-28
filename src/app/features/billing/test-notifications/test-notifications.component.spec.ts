import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { DeliveryStatus, QuotaType, TenantNotification, TenantNotificationKind } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { TestNotificationsComponent } from './test-notifications.component';

const result = (overrides: Partial<TenantNotification> = {}): TenantNotification => ({
  id: 'n1',
  kind: TenantNotificationKind.QuotaExhausted,
  quotaType: QuotaType.LeadCandidates,
  title: "[Test] You've used all your lead candidates",
  body: 'body',
  emailStatus: DeliveryStatus.Sent,
  whatsAppStatus: DeliveryStatus.Sent,
  createdAt: '2026-09-29T00:00:00Z',
  acknowledged: false,
  ...overrides,
});

describe('TestNotificationsComponent', () => {
  let fixture: ComponentFixture<TestNotificationsComponent>;
  let component: TestNotificationsComponent;
  let billing: jasmine.SpyObj<BillingService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    billing = jasmine.createSpyObj('BillingService', ['sendTestNotification']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      declarations: [TestNotificationsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: NotificationService, useValue: notify },
      ],
    });

    fixture = TestBed.createComponent(TestNotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists every notification kind with a Send test button', () => {
    expect(text()).toContain('Quota exhausted');
    expect(text()).toContain('Plan renews tomorrow');
    expect(text()).toContain('Refund approved');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.kind-table tbody tr').length).toBe(component.kinds.length);
  });

  it('sends a quota-threshold kind with its picked quota type, defaulting to lead candidates', () => {
    billing.sendTestNotification.and.returnValue(of(result()));

    component.send(TenantNotificationKind.QuotaExhausted);

    expect(billing.sendTestNotification).toHaveBeenCalledWith({ kind: TenantNotificationKind.QuotaExhausted, quotaType: QuotaType.LeadCandidates });
    expect(notify.success).toHaveBeenCalled();
  });

  it('respects a different picked quota type', () => {
    billing.sendTestNotification.and.returnValue(of(result({ quotaType: QuotaType.WhatsAppMessages })));
    component.quotaTypeByKind[TenantNotificationKind.QuotaLow5] = QuotaType.WhatsAppMessages;

    component.send(TenantNotificationKind.QuotaLow5);

    expect(billing.sendTestNotification).toHaveBeenCalledWith({ kind: TenantNotificationKind.QuotaLow5, quotaType: QuotaType.WhatsAppMessages });
  });

  it('sends a non-quota kind with quotaType null', () => {
    billing.sendTestNotification.and.returnValue(of(result({ kind: TenantNotificationKind.PlanExpiring1, quotaType: null })));

    component.send(TenantNotificationKind.PlanExpiring1);

    expect(billing.sendTestNotification).toHaveBeenCalledWith({ kind: TenantNotificationKind.PlanExpiring1, quotaType: null });
  });

  it('shows the delivery status of the last test for that kind', () => {
    billing.sendTestNotification.and.returnValue(of(result({ emailStatus: DeliveryStatus.Sent, whatsAppStatus: DeliveryStatus.Skipped })));

    component.send(TenantNotificationKind.QuotaExhausted);
    fixture.detectChanges();

    expect(text()).toContain('Sent');
    expect(text()).toContain('Skipped');
  });

  it('shows an error toast without touching other kinds when a send fails', () => {
    billing.sendTestNotification.and.returnValue(throwError(() => ({ error: { message: 'Nope.' } })));

    component.send(TenantNotificationKind.QuotaExhausted);

    expect(notify.error).toHaveBeenCalledWith('Nope.');
    expect(component.lastResult[TenantNotificationKind.QuotaExhausted]).toBeUndefined();
  });
});

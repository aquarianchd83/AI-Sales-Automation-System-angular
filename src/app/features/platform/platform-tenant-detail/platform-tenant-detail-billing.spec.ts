import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { Payment, QuotaBalance, QuotaGrantOrigin, QuotaType } from '../../../core/models/billing.model';
import { TenantStatus } from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { ImpersonationSessionService } from '../../../core/services/impersonation-session.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { PlatformJobService } from '../../../core/services/platform-job.service';
import { PlatformRefundService } from '../../../core/services/platform-refund.service';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTenantDetailComponent } from './platform-tenant-detail.component';

const TENANT_ID = 'c03bc80b-1a44-4ff0-bad1-3bb09d86e357';

const TENANT = {
  id: TENANT_ID, name: 'Confianza IT Solutions', slug: 'confianza', status: TenantStatus.Active,
  createdAt: '2026-09-10T00:00:00Z', trialEndsAtUtc: null, ownerUserId: null, ownerEmail: 'owner@confianza.test', userCount: 2,
  planName: null, subscriptionStatus: null, currentPeriodEndUtc: null, whatsAppConnected: false,
  messagesSentThisMonth: 0, maxMessagesPerMonth: null, aiInteractionsThisMonth: 0, estimatedAiSpendThisMonthUsd: 0,
  timezone: 'Asia/Kolkata', countryCode: 'IN', currencyCode: 'INR', currencySymbol: '₹', estimatedAiSpendThisMonthLocal: 0,
  refundRequestsEnabled: false,
};

// What the console showed after the five adjustments made for this tenant.
const QUOTA: QuotaBalance[] = [
  {
    quotaType: QuotaType.WhatsAppMessages, balance: 16, capacity: 16,
    grants: [10, 3, 3].map((n, i) => ({ id: `w${i}`, origin: QuotaGrantOrigin.Adjustment, unitsGranted: n, unitsRemaining: n, expiresAtUtc: '2027-09-19T00:00:00Z' })),
  },
  { quotaType: QuotaType.AiConversations, balance: 20, capacity: 20, grants: [{ id: 'a0', origin: QuotaGrantOrigin.Adjustment, unitsGranted: 20, unitsRemaining: 20, expiresAtUtc: '2027-09-19T00:00:00Z' }] },
  { quotaType: QuotaType.LeadCandidates, balance: 3, capacity: 3, grants: [{ id: 'l0', origin: QuotaGrantOrigin.Adjustment, unitsGranted: 3, unitsRemaining: 3, expiresAtUtc: '2027-09-19T00:00:00Z' }] },
];

const payment = (id: string, kind: string, localAmount: number): Payment => ({
  id, planName: kind === 'Refund' ? 'Refund: 1,000 AI conversations' : '1,000 AI conversations', amountCents: localAmount < 0 ? -2000 : 2000,
  currencyCode: 'INR', currencySymbol: '₹', localAmount, provider: 'Simulated', paidAtUtc: '2026-09-15T00:00:00Z', kind,
});

describe('PlatformTenantDetailComponent billing cards', () => {
  function setup(payments: Payment[] = []) {
    const refunds = {
      getTenantQuota: jasmine.createSpy('getTenantQuota').and.returnValue(of(QUOTA)),
      getTenantPayments: jasmine.createSpy('getTenantPayments').and.returnValue(of(payments)),
      setRefundRequestsEnabled: jasmine.createSpy('setRefundRequestsEnabled').and.returnValue(of(void 0)),
    };
    const dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(true) }) };
    const notify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), info: jasmine.createSpy('info') };
    const tenant = { ...TENANT };

    TestBed.configureTestingModule({
      declarations: [PlatformTenantDetailComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => TENANT_ID } } } },
        { provide: PlatformTenantService, useValue: { getById: () => of(tenant) } },
        { provide: PlatformBillingService, useValue: { getPlans: () => of([]) } },
        { provide: PlatformJobService, useValue: { getForTenant: () => of(null) } },
        { provide: PlatformTenantConfigService, useValue: { getWhatsAppConfig: () => of(null), getAiConfig: () => of(null), getConfigOverrides: () => of([]) } },
        { provide: TimeZoneService, useValue: { getTimezones: () => of([]) } },
        { provide: BillingService, useValue: { getRegions: () => of([]) } },
        { provide: ImpersonationSessionService, useValue: {} },
        { provide: PlatformRefundService, useValue: refunds },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(PlatformTenantDetailComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const card = (title: string) => Array.from(root.querySelectorAll('mat-card')).find((c) => c.querySelector('h3')?.textContent?.includes(title)) as HTMLElement;
    return { fixture, root, refunds, dialog, notify, tenant, card };
  }

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows what the tenant has left of each quota, and which grants it is made of', () => {
    const { card } = setup();
    const quota = text(card('Prepaid quota'));

    expect(quota).toContain('WhatsApp messages');
    expect(quota).toContain('16');
    expect(quota).toContain('AI conversations');
    expect(quota).toContain('20');
    expect(quota).toContain('Lead candidates');
    expect(quota).toContain('Adjustment · 10 until');
    expect(quota).toContain('Adjustment · 3 until');
  });

  it('opens the adjustment dialog for this tenant and reloads the balances after a change', () => {
    const { card, dialog, refunds } = setup();
    const callsBefore = refunds.getTenantQuota.calls.count();

    (card('Prepaid quota').querySelector('button') as HTMLButtonElement).click();

    const config = dialog.open.calls.mostRecent().args[1];
    expect(config.data).toEqual({ tenantId: TENANT_ID, tenantName: 'Confianza IT Solutions' });
    expect(refunds.getTenantQuota.calls.count()).toBe(callsBefore + 1);
  });

  it('starts with refund requests off and turns them on for this tenant only when asked', () => {
    const { fixture, card, refunds, notify, tenant } = setup();
    const toggle = card('Payments').querySelector('mat-slide-toggle') as HTMLElement;

    expect(toggle.classList).not.toContain('mat-mdc-slide-toggle-checked');

    fixture.componentInstance.setRefundRequests(true);
    fixture.detectChanges();

    expect(refunds.setRefundRequestsEnabled).toHaveBeenCalledOnceWith(TENANT_ID, true);
    expect(tenant.refundRequestsEnabled).toBeTrue();
    expect(notify.success).toHaveBeenCalledWith('This tenant can now request refunds.');
  });

  it('lists payments, refunds a real charge directly, and offers nothing on a refund row', () => {
    const { card, dialog } = setup([payment('pay-1', 'CreditPack', 1660), payment('ref-1', 'Refund', -1162)]);
    const lines = Array.from(card('Payments').querySelectorAll('.payment-line'));

    expect(lines.length).toBe(2);
    expect(text(lines[0])).toContain('₹1,660.00');
    expect(text(lines[1])).toContain('−₹1,162.00');
    expect(lines[1].querySelector('button')).toBeNull();

    (lines[0].querySelector('button') as HTMLButtonElement).click();

    const config = dialog.open.calls.mostRecent().args[1];
    expect(config.data.mode).toBe('direct');
    expect(config.data.payment.id).toBe('pay-1');
    expect(config.data.tenantId).toBe(TENANT_ID);
  });

  it('says so plainly when there are no payments', () => {
    const { card } = setup([]);

    expect(text(card('Payments'))).toContain('No payments yet.');
  });
});

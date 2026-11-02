import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, of } from 'rxjs';

import { Payment, QuotaBalance, QuotaGrantOrigin, QuotaType } from '../../../core/models/billing.model';
import { TenantStatus } from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { ImpersonationSessionService } from '../../../core/services/impersonation-session.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { PlatformJobService } from '../../../core/services/platform-job.service';
import { PlatformRefundService } from '../../../core/services/platform-refund.service';
import { PlatformWhatsAppBridgeService } from '../../../core/services/platform-whatsapp-bridge.service';
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

@Component({ selector: 'app-platform-tenant-provider', template: '' })
class TenantProviderStubComponent {
  @Input() tenantId = '';
}

describe('PlatformTenantDetailComponent billing cards', () => {
  function setup(payments: Payment[] = []) {
    const refunds = {
      getTenantQuota: jasmine.createSpy('getTenantQuota').and.returnValue(of(QUOTA)),
      getTenantLedger: jasmine.createSpy('getTenantLedger').and.returnValue(
        of({
          items: [
            { id: 'l1', entryType: 1, unitsDelta: 500, balanceAfter: 500, occurredAtUtc: '2026-10-23T10:00:00Z' },
            { id: 'l2', entryType: 2, unitsDelta: -12, balanceAfter: 488, occurredAtUtc: '2026-10-24T10:00:00Z' },
          ],
          totalCount: 2,
          page: 1,
          pageSize: 10,
        })
      ),
      getTenantLedgerSummary: jasmine.createSpy('getTenantLedgerSummary').and.callFake((_id: string, _days: number, filter: { entryType?: number } = {}) =>
        of({
          totalEntries: 3,
          byEntryType: [
            { entryType: 1, count: 1, units: 500 },
            { entryType: 2, count: 2, units: -62 },
          ],
          byFeature: [{ feature: 'LeadDiscovery', count: 2, unitsUsed: 62 }],
          daily: [
            { date: '2026-10-22', purchased: 0, used: 0 },
            { date: '2026-10-23', purchased: 500, used: 0 },
            { date: '2026-10-24', purchased: 0, used: filter.entryType === 1 ? 0 : 62 },
          ],
        })
      ),
      getTenantPayments: jasmine.createSpy('getTenantPayments').and.returnValue(of(payments)),
      setRefundRequestsEnabled: jasmine.createSpy('setRefundRequestsEnabled').and.returnValue(of(void 0)),
    };
    const dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(true) }) };
    const notify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), info: jasmine.createSpy('info') };
    const tenant = { ...TENANT };

    TestBed.configureTestingModule({
      declarations: [PlatformTenantDetailComponent, TenantProviderStubComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => TENANT_ID } } } },
        { provide: PlatformTenantService, useValue: { getById: () => of(tenant) } },
        { provide: PlatformBillingService, useValue: { getPlans: () => of([]) } },
        { provide: PlatformJobService, useValue: { getForTenant: () => of(null) } },
        { provide: PlatformTenantConfigService, useValue: { getWhatsAppConfig: () => of(null), getConfigOverrides: () => of([]) } },
        { provide: TimeZoneService, useValue: { getTimezones: () => of([]) } },
        { provide: BillingService, useValue: { getRegions: () => of([]) } },
        { provide: ImpersonationSessionService, useValue: {} },
        // The QR connection card has its own spec; here its status never answers, so it stays idle.
        { provide: PlatformWhatsAppBridgeService, useValue: { getStatus: () => NEVER } },
        { provide: PlatformRefundService, useValue: refunds },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(PlatformTenantDetailComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const card = (title: string) => Array.from(root.querySelectorAll('mat-card, mat-expansion-panel')).find((c) => (c.querySelector('h3, mat-panel-title')?.textContent ?? '').includes(title)) as HTMLElement;
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
    // The per-grant breakdown was removed: it showed units left, which never matched the history entries.
    expect(quota).not.toContain(' until ');
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

  it('shows what each movement was and the balance after it, and can filter by feature', () => {
    const { fixture, refunds, card } = setup([]);
    fixture.componentInstance.showEntries = true;
    fixture.detectChanges();

    expect(text(card('Prepaid quota'))).toContain('Balance after');
    expect(text(card('Prepaid quota'))).toContain('488');

    fixture.componentInstance.onLedgerFilter('LeadDiscovery');

    expect(refunds.getTenantLedger.calls.mostRecent().args[1].feature).toBe('LeadDiscovery');
  });

  it('can show only the purchased credits', () => {
    const { fixture, refunds } = setup([]);

    fixture.componentInstance.onLedgerFilter('Purchased');

    const query = refunds.getTenantLedger.calls.mostRecent().args[1];
    expect(query.entryType).toBe(1);
    expect(query.feature).toBeUndefined();
  });

  it('lists the credit history as date, what happened to the credits (Purchased, Used...), and units', () => {
    const { fixture, card } = setup([]);
    fixture.componentInstance.showEntries = true;
    fixture.detectChanges();

    const rows = Array.from(card('Prepaid quota').querySelectorAll('tr.mat-mdc-row')).map((r) => text(r as HTMLElement));

    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Purchased');
    expect(rows[0]).toContain('+500');
    expect(rows[1]).toContain('Used');
    expect(rows[1]).toContain('-12');
  });

  it('shows a stat tile for every value the history can be narrowed to, totalled over the whole history', () => {
    const { card } = setup([]);

    const tiles = Array.from(card('Prepaid quota').querySelectorAll('.ledger-tile')).map((t) => text(t as HTMLElement));

    expect(tiles.length).toBe(8);
    expect(tiles[0]).toContain('All activity');
    expect(tiles[0]).toContain('3');
    expect(tiles[1]).toContain('Purchased');
    expect(tiles[1]).toContain('500');
    expect(tiles[2]).toContain('Used');
    expect(tiles[2]).toContain('62');
    expect(tiles.find((t) => t.includes('Lead discovery'))).toContain('62');
  });

  it('narrows the entries when a tile is clicked, and draws the daily graph', () => {
    const { fixture, refunds, card } = setup([]);
    const panel = card('Prepaid quota');

    (panel.querySelectorAll('.ledger-tile')[1] as HTMLButtonElement).click();

    expect(refunds.getTenantLedger.calls.mostRecent().args[1].entryType).toBe(1);
    const calls = refunds.getTenantLedgerSummary.calls.allArgs();
    expect(calls[calls.length - 1][2].entryType).toBe(1);
    fixture.detectChanges();

    // Only the purchase is left on the graph; the day that used credits no longer draws a bar.
    expect(panel.querySelectorAll('svg rect.chart-bar').length).toBe(1);
    expect(panel.querySelector('.ledger-chart-head')?.textContent).toContain('Purchased');
    // The tiles keep the whole-history totals.
    expect(panel.querySelectorAll('.ledger-tile').length).toBe(8);
  });

  it('prefixes each amount in the history with a green + when credits came in and a red - when they went out', () => {
    const { fixture, card } = setup([]);
    fixture.componentInstance.showEntries = true;
    fixture.detectChanges();

    const amounts = Array.from(card('Prepaid quota').querySelectorAll('.ledger-amount')) as HTMLElement[];

    expect(amounts[0].textContent?.trim()).toBe('+500');
    expect(amounts[0].classList).toContain('ledger-amount--in');
    expect(amounts[1].textContent?.trim()).toBe('-12');
    expect(amounts[1].classList).toContain('ledger-amount--out');
  });

  it('opens the background jobs in a dialog from the Jobs button, and no longer has a jobs panel on the page', () => {
    const { fixture, dialog } = setup();
    const root = fixture.nativeElement as HTMLElement;

    const jobsButton = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim().endsWith('Jobs')) as HTMLButtonElement;
    jobsButton.click();

    expect(dialog.open).toHaveBeenCalled();
    const [component, config] = dialog.open.calls.mostRecent().args;
    expect(component.name).toBe('PlatformTenantJobsDialogComponent');
    expect(config.data.tenantId).toBe(TENANT_ID);
    expect(root.querySelector('#background-jobs')).toBeNull();
  });

  it('keeps the Billing panel (plan, subscription and the plan override) in a collapsed accordion', () => {
    const { card } = setup();
    const billing = card('Billing');

    expect(billing.tagName.toLowerCase()).toBe('mat-expansion-panel');
    expect(billing.classList).not.toContain('mat-expanded');
    expect(text(billing)).toContain('Override plan');
  });

  it('limits the entries, the tiles and the graph to the chosen dates, and clears them again', () => {
    const { fixture, refunds } = setup([]);
    const component = fixture.componentInstance;

    const callsBefore = refunds.getTenantLedger.calls.count();
    component.fromControl.setValue(new Date(2026, 9, 1));
    component.toControl.setValue(new Date(2026, 9, 24));
    fixture.detectChanges();

    // Picking dates alone changes nothing; the Filter button applies them.
    expect(refunds.getTenantLedger.calls.count()).toBe(callsBefore);
    const filterButton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Filter')
    ) as HTMLButtonElement;
    expect(filterButton.disabled).toBeFalse();
    filterButton.click();
    fixture.detectChanges();

    expect(refunds.getTenantLedger.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ from: '2026-10-01', to: '2026-10-24', page: 1 }));
    expect(refunds.getTenantLedgerSummary.calls.mostRecent().args[2]).toEqual(jasmine.objectContaining({ from: '2026-10-01', to: '2026-10-24' }));
    expect(component.chartPeriod).toBe('2026-10-01 to 2026-10-24');

    component.clearRange();

    expect(refunds.getTenantLedger.calls.mostRecent().args[1].from).toBeUndefined();
    expect(component.chartPeriod).toBe('Last 30 days');
  });

  it('shows the wallet balance in a larger type than the rest of the panel', () => {
    const { card } = setup();

    const balance = card('Prepaid quota').querySelector('.quota-balance') as HTMLElement;

    expect(balance).toBeTruthy();
    expect(parseFloat(getComputedStyle(balance).fontSize)).toBeGreaterThanOrEqual(24);
  });
});

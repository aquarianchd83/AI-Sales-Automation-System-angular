import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  CreditPack,
  QuotaBalance,
  QuotaEntryType,
  QuotaGrantOrigin,
  QuotaType,
  TenantNotificationKind,
} from '../../../core/models/billing.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { BillingService } from '../../../core/services/billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { WalletComponent } from './wallet.component';

const grant = (origin: QuotaGrantOrigin, granted: number, remaining: number) => ({
  id: `${origin}-${granted}`,
  origin,
  unitsGranted: granted,
  unitsRemaining: remaining,
  expiresAtUtc: '2026-09-30T00:00:00Z',
});

const BALANCES: QuotaBalance[] = [
  // Plenty left.
  { quotaType: QuotaType.WhatsAppMessages, balance: 800, capacity: 1000, grants: [grant(QuotaGrantOrigin.PlanAllocation, 1000, 800)] },
  // Under 20% left.
  { quotaType: QuotaType.AiConversations, balance: 100, capacity: 1000, grants: [grant(QuotaGrantOrigin.PlanAllocation, 1000, 100)] },
  // Used up: the grant exists but has nothing left, so it is not listed - only capacity says it was ever there.
  { quotaType: QuotaType.LeadCandidates, balance: 0, capacity: 50, grants: [] },
];

const PACK: CreditPack = {
  id: 'pack-1',
  quotaType: QuotaType.WhatsAppMessages,
  name: '1,000 WhatsApp messages',
  units: 1000,
  priceCents: 2000,
  currencyCode: 'INR',
  currencySymbol: '₹',
  localPriceAmount: 1660,
  taxLines: [],
  taxLocal: 0,
  totalLocal: 1660,
};

describe('WalletComponent', () => {
  function render(options: { planId: string | null; status?: string } = { planId: 'plan-1' }): HTMLElement {
    const billing = {
      getQuota: () => of(BALANCES),
      getCreditPacks: () => of([PACK]),
      getSubscription: () =>
        of(options.planId ? { planId: options.planId, planName: 'Starter', status: options.status ?? 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null } : null),
      getNotifications: () =>
        of([
          {
            id: 'n1',
            kind: TenantNotificationKind.QuotaLow20,
            quotaType: QuotaType.AiConversations,
            title: 'Your AI conversations are running low',
            body: '100 of 1,000 AI conversations are left.',
            emailStatus: 1,
            whatsAppStatus: 1,
            createdAt: '2026-09-19T00:00:00Z',
            acknowledged: false,
          },
        ]),
      getAlertSettings: () => of({ email: 'billing@acme.test', phoneE164: '+919876543210', whatsAppEnabled: true }),
      getLedger: () =>
        of({
          ...emptyPage(),
          totalCount: 2,
          totalPages: 1,
          items: [
            { id: 'e1', quotaType: QuotaType.WhatsAppMessages, entryType: QuotaEntryType.Consumption, unitsDelta: -200, balanceAfter: 800, grantId: null, referenceType: 'Message', referenceId: 'm1', note: 'Marketing', occurredAtUtc: '2026-09-19T10:00:00Z' },
            { id: 'e2', quotaType: QuotaType.WhatsAppMessages, entryType: QuotaEntryType.Allocation, unitsDelta: 1000, balanceAfter: 1000, grantId: null, referenceType: 'Payment', referenceId: 'p1', note: null, occurredAtUtc: '2026-09-01T00:00:00Z' },
          ],
        }),
      acknowledgeNotification: () => of(void 0),
      purchaseCreditPack: () => of({}),
    };

    TestBed.configureTestingModule({
      declarations: [WalletComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: BillingService, useValue: billing }],
    });

    const fixture = TestBed.createComponent(WalletComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows each quota with the right state - plenty, running low, and used up', () => {
    const cards = Array.from(render().querySelectorAll('.balance-card'));

    expect(cards.length).toBe(3);
    expect(text(cards[0])).toContain('WhatsApp messages');
    expect(text(cards[0])).toContain('800');
    expect(text(cards[0])).toContain('of 1,000 available');
    expect(cards[0].classList).toContain('balance-card--ok');

    expect(cards[1].classList).toContain('balance-card--low');
    expect(text(cards[1])).toContain('Running low');

    expect(cards[2].classList).toContain('balance-card--empty');
    expect(text(cards[2])).toContain('Used up');
  });

  it('says where the units came from and when they expire', () => {
    const first = render().querySelectorAll('.balance-card')[0];

    expect(text(first)).toContain('Included in plan');
    expect(text(first)).toContain('until');
  });

  it('lets a tenant with a plan buy credits, priced in their own currency', () => {
    const root = render({ planId: 'plan-1' });
    const buy = root.querySelector('.pack-row button') as HTMLButtonElement;

    expect(text(root.querySelector('.pack-row'))).toContain('₹1,660');
    expect(buy.disabled).toBeFalse();
  });

  it('stops a tenant with no plan from buying and explains why', () => {
    const root = render({ planId: null });
    const buy = root.querySelector('.pack-row button') as HTMLButtonElement;

    expect(buy.disabled).toBeTrue();
    expect(text(root)).toContain('choose a plan first');
  });

  it('shows the unread alert and the ledger in plain words', () => {
    const root = render();

    expect(text(root.querySelector('.notice'))).toContain('running low');
    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row')).map((r) => text(r));
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Used');
    expect(rows[0]).toContain('-200');
    expect(rows[1]).toContain('Plan allocation');
    expect(rows[1]).toContain('+1,000');
  });

  it('pre-fills the alert contact details', () => {
    const inputs = Array.from(render().querySelectorAll('.alert-form input')) as HTMLInputElement[];

    expect(inputs[0].value).toBe('billing@acme.test');
    expect(inputs[1].value).toBe('+919876543210');
  });
});

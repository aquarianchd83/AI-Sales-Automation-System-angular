import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  AiTransaction,
  AiTransactionStatus,
  AiUsageSource,
  AiDenialReason,
  CreditPack,
  QuotaBalance,
  QuotaEntryType,
  QuotaGrantOrigin,
  QuotaType,
} from '../../../core/models/billing.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { PLATFORM_FEATURES, PLATFORM_FEATURE_LABELS, PlatformFeature, WalletSummary } from '../../../core/models/wallet.model';
import { BillingService } from '../../../core/services/billing.service';
import { EntitlementsService } from '../../../core/services/entitlements.service';
import { SharedModule } from '../../../shared/shared.module';
import { WalletComponent } from './wallet.component';

const grant = (origin: QuotaGrantOrigin, granted: number, remaining: number) => ({
  id: `${origin}-${granted}`,
  origin,
  unitsGranted: granted,
  unitsRemaining: remaining,
  expiresAtUtc: '2026-09-30T00:00:00Z',
});

const credits = (balance: number, capacity: number, grants = [grant(QuotaGrantOrigin.PlanAllocation, capacity, balance)]): QuotaBalance[] => [
  { quotaType: QuotaType.Credits, balance, capacity, grants },
];

const PACK: CreditPack = {
  id: 'pack-1',
  quotaType: QuotaType.Credits,
  name: '500 credits',
  units: 500,
  priceCents: 1200,
  currencyCode: 'INR',
  currencySymbol: '₹',
  localPriceAmount: 996,
  taxLines: [],
  taxLocal: 0,
  totalLocal: 996,
};

/** A wallet for a Premium tenant: every feature, WhatsApp capped at 60 with 45 used. Override per test. */
const summary = (over: Partial<WalletSummary> = {}, includeOnly: PlatformFeature[] = PLATFORM_FEATURES): WalletSummary => ({
  balance: 80,
  planCode: 'premium',
  planName: 'Premium',
  monthlyCredits: 100,
  monthStartUtc: '2026-10-01T00:00:00Z',
  features: PLATFORM_FEATURES.map((feature) => ({
    feature,
    label: PLATFORM_FEATURE_LABELS[feature],
    description: '',
    includedInPlan: includeOnly.includes(feature),
    spentThisMonth: feature === 'WhatsAppMessaging' ? 45 : 0,
    monthlyCap: feature === 'WhatsAppMessaging' ? 60 : null,
    costs: [{ scenario: 1, title: 'WhatsApp template send', unitLabel: feature === 'AiConversations' ? 'reply' : 'message', credits: 2, perAction: false }],
  })),
  ...over,
});

describe('WalletComponent', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let billing: Record<string, any>;

  function render(
    options: {
      planId?: string | null;
      status?: string;
      balances?: QuotaBalance[];
      wallet?: WalletSummary;
      aiUsage?: AiTransaction[];
    } = {}
  ): HTMLElement {
    const planId = options.planId === undefined ? 'plan-1' : options.planId;
    billing = {
      getQuota: jasmine.createSpy('getQuota').and.returnValue(of(options.balances ?? credits(80, 100))),
      getWallet: jasmine.createSpy('getWallet').and.returnValue(of(options.wallet ?? summary())),
      setFeatureCap: jasmine.createSpy('setFeatureCap').and.callFake((req: { feature: PlatformFeature; monthlyLimit: number | null }) =>
        of(summary({}, PLATFORM_FEATURES))
      ),
      getAiUsage: jasmine.createSpy('getAiUsage').and.returnValue(
        of({ ...emptyPage<AiTransaction>(), items: options.aiUsage ?? [], totalCount: (options.aiUsage ?? []).length, totalPages: 1 })
      ),
      getCreditPacks: () => of([PACK]),
      getSubscription: () =>
        of(planId ? { planId, planName: 'Premium', status: options.status ?? 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null } : null),
      getAlertSettings: () => of({ email: 'billing@acme.test', phoneE164: '+919876543210', whatsAppEnabled: true }),
      getLedger: jasmine.createSpy('getLedger').and.returnValue(
        of({
          ...emptyPage(),
          totalCount: 2,
          totalPages: 1,
          items: [
            { id: 'e1', quotaType: QuotaType.Credits, feature: 'WhatsAppMessaging', entryType: QuotaEntryType.Consumption, unitsDelta: -2, balanceAfter: 98, grantId: null, referenceType: 'Message', referenceId: 'm1', note: 'Marketing', occurredAtUtc: '2026-09-19T10:00:00Z' },
            { id: 'e2', quotaType: QuotaType.Credits, feature: null, entryType: QuotaEntryType.Allocation, unitsDelta: 100, balanceAfter: 100, grantId: null, referenceType: 'Plan', referenceId: null, note: null, occurredAtUtc: '2026-09-01T00:00:00Z' },
          ],
        })
      ),
      purchaseCreditPack: jasmine.createSpy('purchaseCreditPack').and.returnValue(of({})),
    };

    TestBed.configureTestingModule({
      declarations: [WalletComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: EntitlementsService, useValue: { load: () => of(null) } },
      ],
    });

    const fixture = TestBed.createComponent(WalletComponent);
    fixture.detectChanges();
    component = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    return root;
  }

  let component: WalletComponent;
  let root: HTMLElement;

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  // ---- the one wallet

  it('shows one credit balance with the plan it belongs to, not a balance per feature', () => {
    render();

    const cards = root.querySelectorAll('[data-testid="wallet-card"]');
    expect(cards.length).toBe(1);
    expect(text(cards[0])).toContain('Credits');
    expect(text(root.querySelector('[data-testid="balance"]'))).toBe('80');
    expect(text(root.querySelector('[data-testid="plan-chip"]'))).toContain('Premium plan');
    expect(text(cards[0])).toContain('of 100 available');
    expect(cards[0].classList).toContain('balance-card--ok');
  });

  it('says when the wallet is running low or used up', () => {
    render({ balances: credits(10, 100) });
    expect(root.querySelector('[data-testid="wallet-card"]')!.classList).toContain('balance-card--low');
    expect(text(root.querySelector('[data-testid="wallet-card"]'))).toContain('Running low');

    TestBed.resetTestingModule();
    render({ balances: credits(0, 100, []) });
    expect(root.querySelector('[data-testid="wallet-card"]')!.classList).toContain('balance-card--empty');
    expect(text(root.querySelector('[data-testid="wallet-card"]'))).toContain('Used up');
  });

  it('says where the credits came from: plan credits never expire, bought ones lapse', () => {
    render({ balances: credits(80, 100, [grant(QuotaGrantOrigin.PlanAllocation, 50, 30), grant(QuotaGrantOrigin.CreditPurchase, 50, 50)]) });

    const list = text(root.querySelector('.grant-list'));
    expect(list).toContain('Included in plan');
    expect(list).toContain('never expires');
    expect(list).toContain('Purchased credits');
    expect(list).toContain('until');
  });

  it('tells a Premium tenant about its monthly credits and a Trial tenant what Premium adds', () => {
    render();
    expect(text(root.querySelector('[data-testid="monthly-note"]'))).toContain('100 new credits arrive every month');
    expect(root.querySelector('[data-testid="trial-note"]')).toBeNull();

    TestBed.resetTestingModule();
    render({ wallet: summary({ planName: 'Trial', planCode: 'trial', monthlyCredits: 0 }) });
    expect(root.querySelector('[data-testid="monthly-note"]')).toBeNull();
    expect(text(root.querySelector('[data-testid="trial-note"]'))).toContain('Upgrade to Premium');
  });

  // ---- features, costs and caps

  it('lists every feature with what it costs, what it used this month and its monthly limit', () => {
    render();

    const rows = Array.from(root.querySelectorAll('[data-testid="features-table"] tr.mat-mdc-row')).map((r) => text(r));
    expect(rows.length).toBe(5);
    expect(rows[0]).toContain('WhatsApp messaging');
    expect(rows[0]).toContain('2 credits per message');
    expect(rows[0]).toContain('45'); // used this month
    expect(rows[0]).toContain('45 of 60 used');
    expect(rows[1]).toContain('AI conversations');
    expect(rows[1]).toContain('2 credits per reply');

    const cap = root.querySelector('[data-testid="cap-WhatsAppMessaging"]') as HTMLInputElement;
    expect(cap.value).toBe('60');
  });

  it('marks a feature outside the plan and offers no limit or history for it', () => {
    render({ wallet: summary({}, ['WhatsAppMessaging', 'AiConversations']) });

    const rows = Array.from(root.querySelectorAll('[data-testid="features-table"] tr.mat-mdc-row'));
    const leads = rows.find((r) => text(r).includes('Lead discovery'))!;
    expect(text(leads)).toContain('Not in your plan');
    expect(leads.querySelector('input')).toBeNull();
    expect(leads.classList).toContain('feature-off');
  });

  it('saves a monthly limit for a feature and says so', () => {
    render();
    const messaging = component.featureWallet('ContentStudio')!;

    component.capControls.get('ContentStudio')!.setValue(25);
    expect(component.capChanged(messaging)).toBeTrue();
    component.saveCap(messaging);

    expect(billing['setFeatureCap']).toHaveBeenCalledWith({ feature: 'ContentStudio', monthlyLimit: 25 });
  });

  it('removes a limit by sending none', () => {
    render();

    component.removeCap(component.featureWallet('WhatsAppMessaging')!);

    expect(billing['setFeatureCap']).toHaveBeenCalledWith({ feature: 'WhatsAppMessaging', monthlyLimit: null });
  });

  it('will not save a negative limit', () => {
    render();
    const feature = component.featureWallet('ContentStudio')!;

    component.capControls.get('ContentStudio')!.setValue(-5);
    component.saveCap(feature);

    expect(billing['setFeatureCap']).not.toHaveBeenCalled();
  });

  // ---- history: one wallet, each feature's own ledger

  it('shows the ledger with the feature each row was for, and credits not units', () => {
    render();

    const rows = Array.from(root.querySelectorAll('mat-card#wallet-history tr.mat-mdc-row')).map((r) => text(r));
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('WhatsApp messaging');
    expect(rows[0]).toContain('Used');
    expect(rows[0]).toContain('-2');
    expect(rows[1]).toContain('Renew Plan allocation');
    expect(rows[1]).toContain('+100');
    expect(text(root.querySelector('mat-card#wallet-history'))).toContain('Credits');
  });

  it("narrows the history to one feature's own ledger", () => {
    render();
    billing['getLedger'].calls.reset();

    component.onLedgerFilter('LeadDiscovery');

    expect(billing['getLedger']).toHaveBeenCalledWith({ page: 1, pageSize: jasmine.any(Number), feature: 'LeadDiscovery' });
  });

  // ---- buying

  it('lets a tenant buy credits, priced in their own currency', () => {
    render();
    const buy = root.querySelector('.pack-row button') as HTMLButtonElement;

    expect(text(root.querySelector('.pack-row'))).toContain('₹996');
    expect(text(root.querySelector('.pack-row'))).toContain('500 credits');
    expect(buy.disabled).toBeFalse();
  });

  it('stops a suspended or cancelled account from buying and explains why', () => {
    render({ status: 'Canceled' });
    const buy = root.querySelector('.pack-row button') as HTMLButtonElement;

    expect(buy.disabled).toBeTrue();
    expect(text(root)).toContain("can't be bought while the account is suspended or cancelled");
  });

  it('shows no in-app notifications on the page', () => {
    render();

    expect(root.querySelector('.notice:not(.ai-paused)')).toBeNull();
  });

  it('pre-fills the alert contact details', () => {
    const inputs = Array.from(render().querySelectorAll('.alert-form input')) as HTMLInputElement[];

    expect(inputs[0].value).toBe('billing@acme.test');
    expect(inputs[1].value).toBe('+919876543210');
  });

  describe('AI credits', () => {
    it('tells a tenant out of credits to buy more', () => {
      render({ balances: credits(0, 100, []) });
      const banner = root.querySelector('.ai-paused');

      expect(text(banner)).toContain('Insufficient AI credits. Please purchase additional credits to continue using this feature.');
      expect(text(banner)).toContain('Buy credits');
    });

    it('tells a tenant whose plan has no AI conversations to upgrade instead', () => {
      render({ wallet: summary({}, ['WhatsAppMessaging']) });
      const banner = root.querySelector('.ai-paused');

      expect(text(banner)).toContain('AI conversations are not part of your plan');
    });

    it('shows no banner while there are credits and the plan includes the AI', () => {
      render();

      expect(root.querySelector('.ai-paused')).toBeNull();
    });

    it('lists AI requests with a refunded failure shown as such', () => {
      const row: AiTransaction = {
        id: 't1',
        operation: 'ConversationReply',
        source: AiUsageSource.Paid,
        status: AiTransactionStatus.Failed,
        denialReason: AiDenialReason.None,
        provider: 'OpenAI',
        model: 'gpt-5-nano',
        creditsBefore: 5,
        creditsConsumed: 1,
        creditsAfter: 5,
        creditsRefunded: 1,
        failureReason: 'The AI provider did not return a usable answer.',
        requestedAtUtc: '2026-10-01T10:00:00Z',
        completedAtUtc: '2026-10-01T10:00:01Z',
      };

      render({ aiUsage: [row] });
      const card = root.querySelector('.ai-usage');

      expect(text(card)).toContain('Failed — credit returned');
      expect(text(card)).toContain('The AI provider did not return a usable answer.');
      expect(text(card)).not.toContain('gpt-5-nano');
    });
  });
});

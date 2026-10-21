import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, NonNullableFormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import {
  AI_TRANSACTION_STATUS_LABELS,
  AI_USAGE_SOURCE_LABELS,
  AiTransaction,
  AiTransactionStatus,
  CreditPack,
  INSUFFICIENT_AI_CREDITS_MESSAGE,
  QUOTA_ENTRY_LABELS,
  QUOTA_GRANT_ORIGIN_LABELS,
  QuotaBalance,
  QuotaEntryType,
  QuotaLedgerEntry,
  Subscription,
  formatUnits,
  formatMoney,
  taxBreakdown,
} from '../../../core/models/billing.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  FeatureWallet,
  PLATFORM_FEATURES,
  PLATFORM_FEATURE_ICONS,
  PLATFORM_FEATURE_LABELS,
  PlatformFeature,
  WalletSummary,
  creditsLabel,
} from '../../../core/models/wallet.model';
import { BillingService } from '../../../core/services/billing.service';
import { EntitlementsService } from '../../../core/services/entitlements.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** The wallet card's derived state - kept here so the template stays a plain read. */
interface BalanceView {
  balance: number;
  /** Everything the live grants started with, so "remaining" reads as a share of something. */
  capacity: number;
  percentLeft: number;
  level: 'none' | 'ok' | 'low' | 'empty';
  grants: QuotaBalance['grants'];
}

/**
 * The tenant's single credit wallet: the balance and where it came from, what each feature costs, what each spent this month, the monthly cap the tenant
 * puts on each feature, each feature's own ledger, buying extra credits and where billing alerts are sent. Payment is simulated (see BillingService), so a
 * purchase takes effect immediately - nothing on this page collects card details.
 */
@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss'],
})
export class WalletComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly features = PLATFORM_FEATURES;
  readonly featureLabels = PLATFORM_FEATURE_LABELS;
  readonly featureIcons = PLATFORM_FEATURE_ICONS;
  readonly originLabels = QUOTA_GRANT_ORIGIN_LABELS;
  readonly entryLabels = QUOTA_ENTRY_LABELS;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly formatUnits = formatUnits;
  readonly creditsLabel = creditsLabel;
  readonly featureColumns = ['feature', 'cost', 'spent', 'cap', 'history'];
  readonly ledgerColumns = ['when', 'feature', 'what', 'units', 'balance', 'note'];
  readonly aiColumns = ['when', 'source', 'status', 'credits', 'balance', 'details'];
  readonly aiStatus = AiTransactionStatus;

  readonly alertForm = this.fb.group({
    email: ['', [Validators.email, Validators.maxLength(256)]],
    phoneE164: ['', [Validators.pattern(/^\+[1-9]\d{7,14}$/)]],
    whatsAppEnabled: [true],
  });

  /** One input per feature for its monthly cap; empty means no cap. */
  readonly capControls = new Map<PlatformFeature, FormControl<number | null>>(
    PLATFORM_FEATURES.map((f) => [f, new FormControl<number | null>(null, { validators: [Validators.min(0)] })])
  );

  balance: BalanceView | null = null;
  summary: WalletSummary | null = null;
  packs: CreditPack[] = [];
  subscription: Subscription | null = null;
  ledger: PagedResult<QuotaLedgerEntry> = emptyPage<QuotaLedgerEntry>();
  /** Null shows the whole wallet's history; a feature narrows it to that feature's own ledger. */
  ledgerFilter: PlatformFeature | null = null;
  aiUsage: PagedResult<AiTransaction> = emptyPage<AiTransaction>();

  loading = true;
  loadingLedger = true;
  loadingAiUsage = true;
  savingAlerts = false;
  savingCapFor: PlatformFeature | null = null;
  buyingPackId: string | null = null;

  private ledgerPage = 1;
  private ledgerPageSize = DEFAULT_PAGE_SIZE;
  private aiPage = 1;
  private aiPageSize = DEFAULT_PAGE_SIZE;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog,
    private readonly fb: NonNullableFormBuilder
  ) {}

  ngOnInit(): void {
    this.reloadWallet();
    this.billing.getCreditPacks().subscribe({ next: (packs) => (this.packs = packs) });
    this.billing.getSubscription().subscribe({ next: (subscription) => (this.subscription = subscription) });
    this.loadLedger();
    this.loadAiUsage();
    this.billing.getAlertSettings().subscribe({
      next: (settings) =>
        this.alertForm.reset({
          email: settings.email ?? '',
          phoneE164: settings.phoneE164 ?? '',
          whatsAppEnabled: settings.whatsAppEnabled,
        }),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Credits can be bought on any plan - they are the wallet's top-up. The API says so too; this just explains a suspended or cancelled account up front. */
  get canBuy(): boolean {
    return !this.subscription || ['Active', 'PastDue'].includes(this.subscription.status);
  }

  /** The AI is paused when the plan does not include it or there is nothing left to spend. */
  get aiPaused(): boolean {
    const ai = this.featureWallet('AiConversations');
    const noCredits = !!this.balance && (this.balance.level === 'empty' || this.balance.level === 'none');
    return !this.loading && (noCredits || (!!ai && !ai.includedInPlan));
  }

  get aiPausedMessage(): string {
    const ai = this.featureWallet('AiConversations');
    return ai && !ai.includedInPlan
      ? 'AI conversations are not part of your plan. Upgrade to Premium to use them.'
      : INSUFFICIENT_AI_CREDITS_MESSAGE;
  }

  /** The Trial plan has no monthly credits: it is told what Premium would add. */
  get onPremium(): boolean {
    return (this.summary?.monthlyCredits ?? 0) > 0;
  }

  /** A method rather than indexing the map in the template - a *matCellDef row isn't narrowed. */
  featureIcon(feature: PlatformFeature): string {
    return PLATFORM_FEATURE_ICONS[feature];
  }

  featureWallet(feature: PlatformFeature): FeatureWallet | undefined {
    return this.summary?.features.find((f) => f.feature === feature);
  }

  /** "1 credit per message" - one line per action the feature charges for. */
  costLines(feature: FeatureWallet): string[] {
    return feature.costs.map((c) => `${creditsLabel(c.credits)} per ${c.unitLabel}`);
  }

  /** The cap that is saved, as a number or null. */
  capSaved(feature: FeatureWallet): number | null {
    return feature.monthlyCap;
  }

  /** Whether the input differs from what is saved - the Save button is only live then. */
  capChanged(feature: FeatureWallet): boolean {
    const control = this.capControls.get(feature.feature);
    return !!control && control.valid && (control.value ?? null) !== feature.monthlyCap;
  }

  /** Percent of the cap used this month, for the bar under the input. Null with no cap. */
  capUsedPercent(feature: FeatureWallet): number | null {
    return feature.monthlyCap && feature.monthlyCap > 0 ? Math.min(100, (feature.spentThisMonth / feature.monthlyCap) * 100) : null;
  }

  saveCap(feature: FeatureWallet): void {
    const control = this.capControls.get(feature.feature);
    if (!control || control.invalid || this.savingCapFor) {
      return;
    }
    const limit = control.value === null || (control.value as unknown) === '' ? null : Number(control.value);

    this.savingCapFor = feature.feature;
    this.billing
      .setFeatureCap({ feature: feature.feature, monthlyLimit: limit })
      .pipe(finalize(() => (this.savingCapFor = null)))
      .subscribe((summary) => {
        this.applySummary(summary);
        this.notify.success(limit === null ? `${feature.label} no longer has a monthly limit.` : `${feature.label} is limited to ${creditsLabel(limit)} a month.`);
      });
  }

  removeCap(feature: FeatureWallet): void {
    this.capControls.get(feature.feature)?.setValue(null);
    this.saveCap(feature);
  }

  showHistory(feature: PlatformFeature | null): void {
    this.onLedgerFilter(feature);
    document.getElementById('wallet-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToBuy(): void {
    document.getElementById('buy-credits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  aiStatusLabel(status: AiTransactionStatus): string {
    return AI_TRANSACTION_STATUS_LABELS[status];
  }

  aiSourceLabel(row: AiTransaction): string {
    return AI_USAGE_SOURCE_LABELS[row.source];
  }

  /** "₹999 + GST 18% ₹179.82 = ₹1,178.82" - the price, the tax on top and what is charged. */
  priceWithTax(pack: CreditPack): string {
    if (!pack.taxLocal) {
      return this.formatPrice(pack);
    }
    return `${this.formatPrice(pack)} + ${taxBreakdown(pack.taxLines, pack.currencySymbol)} = ${formatMoney(pack.currencySymbol, pack.totalLocal)}`;
  }

  formatPrice(pack: CreditPack): string {
    const amount = pack.localPriceAmount;
    const decimals = Number.isInteger(amount) ? 0 : 2;
    return `${pack.currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }

  /** A method rather than indexing the label maps in the template - a *matCellDef row isn't narrowed. */
  entryLabel(entry: QuotaEntryType): string {
    return QUOTA_ENTRY_LABELS[entry];
  }

  /** The feature a ledger row was for, or a dash for an allocation, purchase or expiry. */
  rowFeature(row: QuotaLedgerEntry): string {
    return row.feature ? PLATFORM_FEATURE_LABELS[row.feature] : '-';
  }

  buy(pack: CreditPack): void {
    if (this.buyingPackId) {
      return;
    }

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Buy ${pack.name}?`,
          message: `You'll be charged ${pack.taxLocal ? formatMoney(pack.currencySymbol, pack.totalLocal) + ' (' + this.priceWithTax(pack) + ')' : this.formatPrice(pack)}. The credits are added straight away and stay valid for 12 months.`,
          confirmLabel: 'Buy credits',
        },
        width: '460px',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.buyingPackId = pack.id;
        this.billing
          .purchaseCreditPack(pack.id)
          .pipe(finalize(() => (this.buyingPackId = null)))
          .subscribe(() => {
            this.notify.success(`${pack.name} added.`);
            this.reloadWallet();
            this.loadLedger();
            this.loadAiUsage();
            this.entitlements.load(true).subscribe();
          });
      });
  }

  saveAlertSettings(): void {
    const value = this.alertForm.getRawValue();
    if (this.alertForm.invalid || this.savingAlerts) {
      this.alertForm.markAllAsTouched();
      return;
    }
    if (value.whatsAppEnabled && !value.phoneE164.trim()) {
      this.alertForm.controls.phoneE164.setErrors({ required: true });
      this.alertForm.controls.phoneE164.markAsTouched();
      return;
    }

    this.savingAlerts = true;
    this.billing
      .updateAlertSettings({
        email: value.email.trim() || null,
        phoneE164: value.phoneE164.trim() || null,
        whatsAppEnabled: value.whatsAppEnabled,
      })
      .pipe(finalize(() => (this.savingAlerts = false)))
      .subscribe(() => {
        this.notify.success('Alert settings saved.');
        this.alertForm.markAsPristine();
      });
  }

  onLedgerFilter(feature: PlatformFeature | null): void {
    this.ledgerFilter = feature;
    this.ledgerPage = 1;
    this.paginator?.firstPage();
    this.loadLedger();
  }

  onPage(event: PageEvent): void {
    this.ledgerPage = event.pageIndex + 1;
    this.ledgerPageSize = event.pageSize;
    this.loadLedger();
  }

  onAiPage(event: PageEvent): void {
    this.aiPage = event.pageIndex + 1;
    this.aiPageSize = event.pageSize;
    this.loadAiUsage();
  }

  private loadAiUsage(): void {
    this.loadingAiUsage = true;
    this.billing
      .getAiUsage({ page: this.aiPage, pageSize: this.aiPageSize })
      .pipe(finalize(() => (this.loadingAiUsage = false)))
      .subscribe({ next: (page) => (this.aiUsage = page) });
  }

  private reloadWallet(): void {
    this.loading = true;
    this.billing
      .getWallet()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (summary) => this.applySummary(summary) });
    this.billing.getQuota().pipe(takeUntil(this.destroy$)).subscribe({ next: (balances) => (this.balance = balances.length ? this.toView(balances[0]) : null) });
  }

  private applySummary(summary: WalletSummary): void {
    this.summary = summary;
    for (const feature of summary.features) {
      this.capControls.get(feature.feature)?.setValue(feature.monthlyCap, { emitEvent: false });
    }
  }

  private loadLedger(): void {
    this.loadingLedger = true;
    this.billing
      .getLedger({ page: this.ledgerPage, pageSize: this.ledgerPageSize, feature: this.ledgerFilter ?? undefined })
      .pipe(finalize(() => (this.loadingLedger = false)))
      .subscribe({ next: (page) => (this.ledger = page) });
  }

  private toView(balance: QuotaBalance): BalanceView {
    const capacity = balance.capacity;
    const percentLeft = capacity > 0 ? Math.min(100, (balance.balance / capacity) * 100) : 0;
    const level: BalanceView['level'] = capacity === 0 ? 'none' : balance.balance <= 0 ? 'empty' : percentLeft <= 20 ? 'low' : 'ok';
    return { balance: balance.balance, capacity, percentLeft, level, grants: balance.grants };
  }
}

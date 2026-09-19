import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import {
  CreditPack,
  QUOTA_ENTRY_LABELS,
  QUOTA_GRANT_ORIGIN_LABELS,
  QUOTA_TYPES,
  QUOTA_TYPE_ICONS,
  QUOTA_TYPE_LABELS,
  QuotaBalance,
  QuotaEntryType,
  QuotaLedgerEntry,
  QuotaType,
  Subscription,
  TenantNotification,
  formatUnits,
  isUrgentNotification,
} from '../../../core/models/billing.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** A balance card's worth of derived state — kept here so the template stays a plain read. */
interface BalanceView {
  type: QuotaType;
  balance: number;
  /** Everything the live grants started with, so "remaining" reads as a share of something. */
  capacity: number;
  percentLeft: number;
  level: 'none' | 'ok' | 'low' | 'empty';
  grants: QuotaBalance['grants'];
}

/**
 * The tenant's prepaid usage: how much of each quota is left and where it came from, buying extra credits, the
 * ledger of every movement, and where billing alerts are sent. Payment is simulated (see BillingService), so a
 * purchase takes effect immediately — nothing on this page collects card details.
 */
@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss'],
})
export class WalletComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly quotaTypes = QUOTA_TYPES;
  readonly typeLabels = QUOTA_TYPE_LABELS;
  readonly typeIcons = QUOTA_TYPE_ICONS;
  readonly originLabels = QUOTA_GRANT_ORIGIN_LABELS;
  readonly entryLabels = QUOTA_ENTRY_LABELS;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly formatUnits = formatUnits;
  readonly ledgerColumns = ['when', 'quota', 'what', 'units', 'balance', 'note'];

  readonly alertForm = this.fb.group({
    email: ['', [Validators.email, Validators.maxLength(256)]],
    phoneE164: ['', [Validators.pattern(/^\+[1-9]\d{7,14}$/)]],
    whatsAppEnabled: [true],
  });

  balances: BalanceView[] = [];
  packs: CreditPack[] = [];
  subscription: Subscription | null = null;
  notifications: TenantNotification[] = [];
  ledger: PagedResult<QuotaLedgerEntry> = emptyPage<QuotaLedgerEntry>();
  ledgerFilter: QuotaType | null = null;

  loading = true;
  loadingLedger = true;
  savingAlerts = false;
  buyingPackId: string | null = null;

  private ledgerPage = 1;
  private ledgerPageSize = DEFAULT_PAGE_SIZE;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly billing: BillingService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog,
    private readonly fb: NonNullableFormBuilder
  ) {}

  ngOnInit(): void {
    this.reloadBalances();
    this.billing.getCreditPacks().subscribe({ next: (packs) => (this.packs = packs) });
    this.billing.getSubscription().subscribe({ next: (subscription) => (this.subscription = subscription) });
    this.loadNotifications();
    this.loadLedger();
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

  /** Credits can only be bought against a live plan — the API says so too, this just explains it up front. */
  get canBuy(): boolean {
    return !!this.subscription?.planId && ['Active', 'PastDue'].includes(this.subscription.status);
  }

  packsFor(type: QuotaType): CreditPack[] {
    return this.packs.filter((p) => p.quotaType === type);
  }

  urgent(notification: TenantNotification): boolean {
    return isUrgentNotification(notification.kind);
  }

  formatPrice(pack: CreditPack): string {
    const amount = pack.localPriceAmount;
    const decimals = Number.isInteger(amount) ? 0 : 2;
    return `${pack.currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }

  /** A method rather than indexing the label maps in the template — a *matCellDef row isn't narrowed. */
  entryLabel(entry: QuotaEntryType): string {
    return QUOTA_ENTRY_LABELS[entry];
  }

  typeLabel(type: QuotaType): string {
    return QUOTA_TYPE_LABELS[type];
  }

  buy(pack: CreditPack): void {
    if (this.buyingPackId) {
      return;
    }

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Buy ${pack.name}?`,
          message: `You'll be charged ${this.formatPrice(pack)}. The credits are added straight away and stay valid for 12 months.`,
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
            this.reloadBalances();
            this.loadLedger();
          });
      });
  }

  dismiss(notification: TenantNotification): void {
    this.billing.acknowledgeNotification(notification.id).subscribe(() => {
      notification.acknowledged = true;
      this.notifications = this.notifications.filter((n) => !n.acknowledged);
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

  onLedgerFilter(type: QuotaType | null): void {
    this.ledgerFilter = type;
    this.ledgerPage = 1;
    this.paginator?.firstPage();
    this.loadLedger();
  }

  onPage(event: PageEvent): void {
    this.ledgerPage = event.pageIndex + 1;
    this.ledgerPageSize = event.pageSize;
    this.loadLedger();
  }

  private reloadBalances(): void {
    this.loading = true;
    this.billing
      .getQuota()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (balances) => (this.balances = balances.map((b) => this.toView(b))) });
  }

  private loadNotifications(): void {
    this.billing.getNotifications().subscribe({ next: (all) => (this.notifications = all.filter((n) => !n.acknowledged)) });
  }

  private loadLedger(): void {
    this.loadingLedger = true;
    this.billing
      .getLedger({ page: this.ledgerPage, pageSize: this.ledgerPageSize, quotaType: this.ledgerFilter ?? undefined })
      .pipe(finalize(() => (this.loadingLedger = false)))
      .subscribe({ next: (page) => (this.ledger = page) });
  }

  private toView(balance: QuotaBalance): BalanceView {
    const capacity = balance.capacity;
    const percentLeft = capacity > 0 ? Math.min(100, (balance.balance / capacity) * 100) : 0;
    const level: BalanceView['level'] =
      capacity === 0 ? 'none' : balance.balance <= 0 ? 'empty' : percentLeft <= 20 ? 'low' : 'ok';
    return { type: balance.quotaType, balance: balance.balance, capacity, percentLeft, level, grants: balance.grants };
  }
}

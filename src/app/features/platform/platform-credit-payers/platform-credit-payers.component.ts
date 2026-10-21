import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';

import { QUOTA_TYPE_LABELS, QuotaType } from '../../../core/models/billing.model';
import {
  CREDIT_PAYER_LABELS,
  CREDIT_USAGE_STATUS_LABELS,
  CreditPayer,
  CreditScenario,
  CreditScenarioInfo,
  CreditUsage,
  CreditUsageStatus,
  PLATFORM_CREDIT_ENTRY_LABELS,
  PlatformCreditEntry,
  PlatformCreditEntryType,
  PlatformCreditWallet,
  canRedeem,
} from '../../../core/models/credit-payer.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformCreditPayerService } from '../../../core/services/platform-credit-payer.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformCreditRedeemDialogComponent } from './platform-credit-redeem-dialog.component';
import { PlatformCreditWalletDialogComponent } from './platform-credit-wallet-dialog.component';

/**
 * Credit Payers: for every situation where credits are spent, who pays - the tenant's own balance or the platform's wallet - and the record
 * of who paid for each spend. The switch can be flipped at any time and applies to what happens next; spends already made keep the account
 * they were charged to. When the platform's wallet cannot cover a spend the tenant pays instead (and the activity says so), and a platform
 * admin can give those credits back.
 *
 * Timestamps arrive as UTC with a trailing Z and are shown in the viewer's timezone by the zonedDate pipe.
 */
@Component({
  selector: 'app-platform-credit-payers',
  templateUrl: './platform-credit-payers.component.html',
  styleUrls: ['./platform-credit-payers.component.scss'],
})
export class PlatformCreditPayersComponent implements OnInit, OnDestroy {
  readonly CreditPayer = CreditPayer;
  readonly payerLabels = CREDIT_PAYER_LABELS;
  readonly statusLabels = CREDIT_USAGE_STATUS_LABELS;
  readonly quotaLabels = QUOTA_TYPE_LABELS;
  readonly entryLabels = PLATFORM_CREDIT_ENTRY_LABELS;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statuses = [CreditUsageStatus.Charged, CreditUsageStatus.Reversed, CreditUsageStatus.Redeemed, CreditUsageStatus.Unpaid];
  readonly payers = [CreditPayer.Tenant, CreditPayer.Platform];

  readonly scenarioColumns = ['scenario', 'payer', 'units', 'activity', 'cost'];
  readonly usageColumns = ['occurredAt', 'tenant', 'scenario', 'units', 'paidBy', 'status', 'actions'];
  readonly ledgerColumns = ['occurredAt', 'type', 'units', 'balance', 'tenant', 'note'];

  scenarios: CreditScenarioInfo[] = [];
  scenariosLoading = true;
  /** Per-scenario "credits per action" being typed, before it is saved. */
  readonly unitsDraft = new Map<CreditScenario, number | null>();
  readonly savingScenario = new Set<CreditScenario>();

  wallets: PlatformCreditWallet[] = [];

  usage: PagedResult<CreditUsage> = emptyPage<CreditUsage>();
  usageLoading = true;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  scenarioFilter: CreditScenario | null = null;
  chargedToFilter: CreditPayer | null = null;
  statusFilter: CreditUsageStatus | null = null;
  fallbackOnly = false;
  private usageQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };

  ledger: PagedResult<PlatformCreditEntry> = emptyPage<PlatformCreditEntry>();
  ledgerLoading = true;
  private ledgerQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly credits: PlatformCreditPayerService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadScenarios();
    this.loadWallets();
    this.loadUsage();
    this.loadLedger();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.usageQuery = { ...this.usageQuery, page: 1 };
        this.loadUsage();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  quotaLabel(type: QuotaType): string {
    return this.quotaLabels[type];
  }

  payerLabel(payer: CreditPayer): string {
    return this.payerLabels[payer];
  }

  statusLabel(status: CreditUsageStatus): string {
    return this.statusLabels[status];
  }

  entryLabel(type: PlatformCreditEntryType): string {
    return this.entryLabels[type];
  }

  // ----- scenarios --------------------------------------------------------------------------------------------------------------

  /** The platform wallet for a scenario's credit type is empty, so a scenario set to "Platform" falls back to charging the tenant. */
  walletEmptyFor(scenario: CreditScenarioInfo): boolean {
    return scenario.payer === CreditPayer.Platform && scenario.platformBalance <= 0 && this.unitsFor(scenario) !== 0;
  }

  unitsFor(scenario: CreditScenarioInfo): number | null {
    return scenario.unitsConfigurable ? scenario.unitsPerAction ?? 0 : null;
  }

  isFree(scenario: CreditScenarioInfo): boolean {
    return scenario.unitsConfigurable && !scenario.unitsPerAction;
  }

  draftUnits(scenario: CreditScenarioInfo): number | null {
    return this.unitsDraft.has(scenario.scenario) ? this.unitsDraft.get(scenario.scenario)! : scenario.unitsPerAction;
  }

  setDraftUnits(scenario: CreditScenarioInfo, value: string): void {
    const parsed = value === '' ? null : Number(value);
    this.unitsDraft.set(scenario.scenario, parsed == null || Number.isNaN(parsed) ? null : parsed);
  }

  unitsChanged(scenario: CreditScenarioInfo): boolean {
    return this.unitsDraft.has(scenario.scenario) && this.unitsDraft.get(scenario.scenario) !== scenario.unitsPerAction;
  }

  unitsValid(scenario: CreditScenarioInfo): boolean {
    const draft = this.draftUnits(scenario);
    return draft != null && draft >= 0;
  }

  /** Switching who pays is confirmed first - it changes whose balance the next customer message comes out of. */
  changePayer(scenario: CreditScenarioInfo, payer: CreditPayer): void {
    if (payer === scenario.payer || this.savingScenario.has(scenario.scenario)) {
      return;
    }

    const toPlatform = payer === CreditPayer.Platform;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: toPlatform ? 'Platform will pay' : 'Tenants will pay',
          message: toPlatform
            ? `From now on "${scenario.title}" comes out of the platform wallet. If the wallet runs out, the tenant is charged instead. Past activity is not changed.`
            : `From now on "${scenario.title}" comes out of each tenant's own balance. Past activity is not changed.`,
          confirmLabel: 'Switch',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.saveScenario(scenario, { payer, unitsPerAction: scenario.unitsConfigurable ? scenario.unitsPerAction : null });
        }
      });
  }

  saveUnits(scenario: CreditScenarioInfo): void {
    if (!this.unitsValid(scenario)) {
      return;
    }
    this.saveScenario(scenario, { payer: scenario.payer, unitsPerAction: this.draftUnits(scenario) });
  }

  private saveScenario(scenario: CreditScenarioInfo, request: { payer: CreditPayer; unitsPerAction: number | null }): void {
    this.savingScenario.add(scenario.scenario);
    this.credits
      .setPayer(scenario.scenario, request)
      .pipe(finalize(() => this.savingScenario.delete(scenario.scenario)))
      .subscribe((updated) => {
        this.scenarios = this.scenarios.map((s) => (s.scenario === updated.scenario ? updated : s));
        this.unitsDraft.delete(scenario.scenario);
        this.notify.success(`${updated.title}: ${updated.payer === CreditPayer.Platform ? 'platform' : 'tenants'} pay.`);
        this.loadUsage();
      });
  }

  private loadScenarios(): void {
    this.scenariosLoading = true;
    this.credits
      .getScenarios()
      .pipe(
        catchError(() => of<CreditScenarioInfo[]>([])),
        finalize(() => (this.scenariosLoading = false))
      )
      .subscribe((scenarios) => (this.scenarios = scenarios));
  }

  // ----- platform wallet --------------------------------------------------------------------------------------------------------

  balanceOf(quotaType: QuotaType): number {
    return this.wallets.find((w) => w.quotaType === quotaType)?.balance ?? 0;
  }

  openWalletDialog(quotaType?: QuotaType): void {
    this.dialog
      .open(PlatformCreditWalletDialogComponent, { width: '440px', data: { quotaType: quotaType ?? null } })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.loadWallets();
          this.loadScenarios();
          this.ledgerQuery = { ...this.ledgerQuery, page: 1 };
          this.loadLedger();
        }
      });
  }

  onLedgerPage(event: PageEvent): void {
    this.ledgerQuery = { page: event.pageIndex + 1, pageSize: event.pageSize };
    this.loadLedger();
  }

  private loadWallets(): void {
    this.credits
      .getWallets()
      .pipe(catchError(() => of<PlatformCreditWallet[]>([])))
      .subscribe((wallets) => (this.wallets = wallets));
  }

  private loadLedger(): void {
    this.ledgerLoading = true;
    this.credits
      .getWalletLedger(this.ledgerQuery)
      .pipe(
        catchError(() => of(emptyPage<PlatformCreditEntry>(this.ledgerQuery.pageSize))),
        finalize(() => (this.ledgerLoading = false))
      )
      .subscribe((page) => (this.ledger = page));
  }

  // ----- activity ---------------------------------------------------------------------------------------------------------------

  filtersChanged(): void {
    this.usageQuery = { ...this.usageQuery, page: 1 };
    this.loadUsage();
  }

  onUsagePage(event: PageEvent): void {
    this.usageQuery = { page: event.pageIndex + 1, pageSize: event.pageSize };
    this.loadUsage();
  }

  canRedeem(usage: CreditUsage): boolean {
    return canRedeem(usage);
  }

  redeem(usage: CreditUsage): void {
    this.dialog
      .open(PlatformCreditRedeemDialogComponent, { width: '460px', data: { usage } })
      .afterClosed()
      .subscribe((redeemed) => {
        if (redeemed) {
          this.loadUsage();
        }
      });
  }

  private loadUsage(): void {
    this.usageLoading = true;
    this.credits
      .getUsage({
        ...this.usageQuery,
        search: this.searchControl.value || undefined,
        scenario: this.scenarioFilter,
        chargedTo: this.chargedToFilter,
        status: this.statusFilter,
        fellBackToTenant: this.fallbackOnly ? true : null,
      })
      .pipe(
        catchError(() => of(emptyPage<CreditUsage>(this.usageQuery.pageSize))),
        finalize(() => (this.usageLoading = false))
      )
      .subscribe((page) => (this.usage = page));
  }
}

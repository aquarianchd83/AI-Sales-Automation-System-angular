import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { QUOTA_TYPE_LABELS, QuotaType, formatUnits } from '../../../core/models/billing.model';
import {
  PlatformCreditPack,
  PlatformPlan,
  PlatformSubscriptionListItem,
  PlatformSubscriptionQuery,
  SUBSCRIPTION_STATUS_LABELS,
  SubscriptionStatus,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformCreditPackFormDialogComponent } from '../platform-credit-pack-form-dialog/platform-credit-pack-form-dialog.component';
import { PlatformPlanFormDialogComponent } from '../platform-plan-form-dialog/platform-plan-form-dialog.component';

@Component({
  selector: 'app-platform-billing',
  templateUrl: './platform-billing.component.html',
  styleUrls: ['./platform-billing.component.scss'],
})
export class PlatformBillingComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['tenant', 'plan', 'status', 'currentPeriodEnd', 'failedPayment'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly subscriptionStatusLabels = SUBSCRIPTION_STATUS_LABELS;

  readonly packColumns = ['name', 'type', 'units', 'price', 'status', 'actions'];
  readonly formatUnits = formatUnits;

  plans: PlatformPlan[] = [];
  loadingPlans = true;

  packs: PlatformCreditPack[] = [];
  loadingPacks = true;

  subscriptionsPage: PagedResult<PlatformSubscriptionListItem> = emptyPage<PlatformSubscriptionListItem>();
  loadingSubscriptions = true;

  private query: PlatformSubscriptionQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly billing: PlatformBillingService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadPacks();

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loadingSubscriptions = true;
          return this.billing.getSubscriptions(this.query).pipe(
            catchError(() => of(emptyPage<PlatformSubscriptionListItem>(this.query.pageSize))),
            finalize(() => (this.loadingSubscriptions = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.subscriptionsPage = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  /** Shown in the operator's own currency (from their profile country); the catalog itself is still
   * authored in USD, which is what the add/edit dialog writes. */
  formatPrice(plan: PlatformPlan): string {
    const whole = Number.isInteger(plan.priceMonthlyLocal);
    return `${plan.currencySymbol}${plan.priceMonthlyLocal.toFixed(whole ? 0 : 2)}/mo`;
  }

  /** The authored figure, for the card's secondary line — so an operator editing the plan knows what the
   * dialog will show them. Omitted when the operator is already on USD. */
  formatBasePrice(plan: PlatformPlan): string | null {
    if (plan.currencyCode === 'USD') {
      return null;
    }
    const usd = plan.priceMonthlyCents / 100;
    return `$${usd.toFixed(usd % 1 === 0 ? 0 : 2)} USD`;
  }

  quotaLabel(type: QuotaType): string {
    return QUOTA_TYPE_LABELS[type];
  }

  formatPackPrice(pack: PlatformCreditPack): string {
    return `${pack.currencySymbol}${pack.priceLocal.toFixed(Number.isInteger(pack.priceLocal) ? 0 : 2)}`;
  }

  addPack(): void {
    this.openPackDialog(null);
  }

  editPack(pack: PlatformCreditPack): void {
    this.openPackDialog(pack);
  }

  retirePack(pack: PlatformCreditPack): void {
    const data: ConfirmDialogData = {
      title: 'Retire this credit pack?',
      message: `${pack.name} will stop being offered. Credits tenants already bought from it are unaffected.`,
      confirmLabel: 'Retire',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.billing.deleteCreditPack(pack.id).subscribe({
          next: () => {
            this.notify.success('Credit pack retired.');
            this.loadPacks();
          },
        });
      });
  }

  addPlan(): void {
    this.openPlanDialog(null);
  }

  editPlan(plan: PlatformPlan): void {
    this.openPlanDialog(plan);
  }

  deletePlan(plan: PlatformPlan): void {
    const data: ConfirmDialogData = {
      title: 'Retire this plan?',
      message: `${plan.name} will no longer be offered to new or upgrading tenants. Existing subscribers keep their current limits — this never deletes the plan outright.`,
      confirmLabel: 'Retire',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.billing.deletePlan(plan.id).subscribe({
          next: () => {
            this.notify.success('Plan retired.');
            this.loadPlans();
          },
        });
      });
  }

  private openPlanDialog(plan: PlatformPlan | null): void {
    this.dialog
      .open(PlatformPlanFormDialogComponent, { data: { plan }, width: '480px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadPlans();
        }
      });
  }

  private openPackDialog(pack: PlatformCreditPack | null): void {
    this.dialog
      .open(PlatformCreditPackFormDialogComponent, { data: { pack }, width: '480px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadPacks();
        }
      });
  }

  private loadPacks(): void {
    this.loadingPacks = true;
    this.billing.getCreditPacks().subscribe({
      next: (packs) => {
        this.packs = packs;
        this.loadingPacks = false;
      },
      error: () => (this.loadingPacks = false),
    });
  }

  private loadPlans(): void {
    this.loadingPlans = true;
    this.billing.getPlans().subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loadingPlans = false;
      },
      error: () => (this.loadingPlans = false),
    });
  }

  /** See PlatformTenantListComponent.statusLabel's own comment for why this is a method, not a
   * template-level Record index. */
  subscriptionStatusLabel(status: SubscriptionStatus | null): string {
    return status === null ? '—' : this.subscriptionStatusLabels[status];
  }
}

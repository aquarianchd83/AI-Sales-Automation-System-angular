import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  PlatformPlan,
  PlatformSubscriptionListItem,
  PlatformSubscriptionQuery,
  SUBSCRIPTION_STATUS_LABELS,
  SubscriptionStatus,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
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

  plans: PlatformPlan[] = [];
  loadingPlans = true;

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

  formatPrice(priceMonthlyCents: number): string {
    return `$${(priceMonthlyCents / 100).toFixed(priceMonthlyCents % 100 === 0 ? 0 : 2)}/mo`;
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

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { formatCharge, taxBreakdown } from '../../../core/models/billing.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  PLATFORM_PAYMENT_KIND_LABELS,
  PlatformPaymentKind,
  PlatformPaymentListItem,
  PlatformPaymentQuery,
  RevenueFigures,
} from '../../../core/models/platform.model';
import { PlatformPaymentService } from '../../../core/services/platform-payment.service';
import { PlatformRevenueService } from '../../../core/services/platform-revenue.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';

/** A reminder card: where one kind of payment stands for this tenant. */
interface Reminder {
  title: string;
  icon: string;
  headline: string;
  detail: string;
  /** Something is coming up or overdue-looking, so the card is highlighted. */
  attention: boolean;
}

/** Window the reminder cards read from: the newest payments, with the upcoming subscription charge always first. */
const REMINDER_WINDOW = 100;

/**
 * One tenant's payment history, reached from the Revenue Report. The grid is ordered by processing date - when the payment was taken - newest first, with the
 * subscription still to be charged at the top. Above it, a reminder for each of subscriptions and credit packs: when the next charge is due and when the last
 * one was processed.
 */
@Component({
  selector: 'app-platform-tenant-payments',
  templateUrl: './platform-tenant-payments.component.html',
  styleUrls: ['./platform-tenant-payments.component.scss'],
})
export class PlatformTenantPaymentsComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['processedAt', 'kind', 'description', 'status', 'amount', 'inr', 'provider'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly formatCharge = formatCharge;
  readonly kindControl = new FormControl<PlatformPaymentKind | ''>('', { nonNullable: true });

  tenantId = '';
  tenantName = '';
  page: PagedResult<PlatformPaymentListItem> = emptyPage<PlatformPaymentListItem>();
  reminders: Reminder[] = [];
  /** Everything this tenant has ever paid, in rupees; null until loaded. */
  totals: RevenueFigures | null = null;
  loading = true;

  private query: PlatformPaymentQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly payments: PlatformPaymentService,
    private readonly tenants: PlatformTenantService,
    private readonly revenue: PlatformRevenueService
  ) {}

  /** Rupees, Indian digit grouping. */
  inr(value: number): string {
    const digits = Math.abs(value) >= 1000 ? 0 : 2;
    return '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('id') ?? '';
    this.query = { ...this.query, tenantId: this.tenantId };

    this.tenants
      .getById(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (tenant) => (this.tenantName = tenant.name), error: () => undefined });

    this.revenue
      .get(undefined, undefined, this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (report) => (this.totals = report.totals), error: () => undefined });

    this.payments
      .getPaged({ page: 1, pageSize: REMINDER_WINDOW, tenantId: this.tenantId })
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (all) => (this.reminders = this.buildReminders(all.items)), error: () => undefined });

    this.kindControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((kind) => {
      this.query = { ...this.query, page: 1, kind: kind || undefined };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.payments.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformPaymentListItem>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  /** A charge that has actually happened. Anything else is a monthly subscription still to be charged. */
  isPaid(row: PlatformPaymentListItem): boolean {
    return !row.status || row.status === 'Paid';
  }

  statusLabel(row: PlatformPaymentListItem): string {
    switch (row.status) {
      case 'Upcoming':
        return 'Upcoming';
      case 'NotScheduled':
        return 'Not scheduled';
      case 'NoPrice':
        return 'No price';
      default:
        return row.kind === 'Refund' ? 'Refunded' : 'Paid';
    }
  }

  kindLabel(kind: string): string {
    return PLATFORM_PAYMENT_KIND_LABELS[kind] ?? kind;
  }

  /** What the tenant actually paid on a row: the total including tax. Rows from before tax was recorded show their price. */
  paidLocal(row: PlatformPaymentListItem): number {
    return row.totalLocal ? row.totalLocal : row.localAmount;
  }

  taxNote(row: PlatformPaymentListItem): string {
    return row.taxLocal ? `incl. ${taxBreakdown(row.taxLines, row.currencySymbol)}` : '';
  }

  private buildReminders(rows: PlatformPaymentListItem[]): Reminder[] {
    const upcoming = rows.find((r) => r.kind === 'Subscription' && !this.isPaid(r));
    const lastSubscription = rows.find((r) => r.kind === 'Subscription' && this.isPaid(r));
    const lastPack = rows.find((r) => r.kind === 'CreditPack');

    return [
      {
        title: 'Subscription',
        icon: 'autorenew',
        headline: this.subscriptionHeadline(upcoming),
        detail: lastSubscription ? `Last processed ${this.when(lastSubscription.paidAtUtc)}` : 'No subscription payment processed yet',
        attention: upcoming?.status === 'Upcoming',
      },
      {
        title: 'Credit pack',
        icon: 'toll',
        headline: lastPack ? `Last bought ${this.when(lastPack.paidAtUtc)}` : 'No credit pack bought yet',
        detail: lastPack ? `${lastPack.description || 'Credit pack'} - ${formatCharge(this.paidLocal(lastPack), lastPack.currencySymbol)}` : 'Packs are bought on demand, so none is due',
        attention: false,
      },
    ];
  }

  private subscriptionHeadline(upcoming: PlatformPaymentListItem | undefined): string {
    if (!upcoming) return 'No subscription';
    switch (upcoming.status) {
      case 'Upcoming':
        return `Next charge due ${this.when(upcoming.dueAtUtc)}`;
      case 'NotScheduled':
        return 'Plan set, no charge scheduled yet';
      default:
        return 'Plan has no price in this tenant\'s country';
    }
  }

  /** dd MMM yyyy in the viewer's own zone, matching the zonedDate pipe the grid uses. */
  private when(utc: string | null | undefined): string {
    if (!utc) return '-';
    const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(utc) ? utc : `${utc}Z`;
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  }
}

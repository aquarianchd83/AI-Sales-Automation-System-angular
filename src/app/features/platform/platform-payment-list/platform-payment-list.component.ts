import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { formatCharge, taxBreakdown } from '../../../core/models/billing.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  PLATFORM_PAYMENT_KIND_LABELS,
  PlatformPaymentKind,
  PlatformPaymentListItem,
  PlatformPaymentQuery,
} from '../../../core/models/platform.model';
import { PlatformPaymentService } from '../../../core/services/platform-payment.service';

@Component({
  selector: 'app-platform-payment-list',
  templateUrl: './platform-payment-list.component.html',
  styleUrls: ['./platform-payment-list.component.scss'],
})
export class PlatformPaymentListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['paidAt', 'tenant', 'kind', 'description', 'amount', 'inr', 'provider'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly formatCharge = formatCharge;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly kindControl = new FormControl<PlatformPaymentKind | ''>('', { nonNullable: true });

  page: PagedResult<PlatformPaymentListItem> = emptyPage<PlatformPaymentListItem>();
  loading = true;

  private query: PlatformPaymentQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly payments: PlatformPaymentService) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

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

  kindLabel(kind: string): string {
    return PLATFORM_PAYMENT_KIND_LABELS[kind] ?? kind;
  }

  /** What a tenant actually paid on a row: the total including tax. Rows from before tax was recorded show their price. */
  paidLocal(row: PlatformPaymentListItem): number {
    return row.totalLocal ? row.totalLocal : row.localAmount;
  }

  /** "GST 18% ₹179.82" under the amount. Empty when no tax was charged. */
  taxNote(row: PlatformPaymentListItem): string {
    return row.taxLocal ? `incl. ${taxBreakdown(row.taxLines, row.currencySymbol)}` : '';
  }

  /** Net of the rows on this page in rupees - the platform admin is in India, and each payment carries its rupee value at the
   * rate of the day, so rows in different currencies add up honestly. Refunds are negative: money kept, not money taken. */
  get pageTotalInr(): number {
    return this.page.items.reduce((sum, row) => sum + (row.amountInr ?? 0), 0);
  }
}

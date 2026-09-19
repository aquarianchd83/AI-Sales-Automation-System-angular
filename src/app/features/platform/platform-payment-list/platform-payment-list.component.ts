import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { formatCharge } from '../../../core/models/billing.model';
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

  readonly displayedColumns = ['paidAt', 'tenant', 'kind', 'description', 'amount', 'provider'];
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

  /** Net of the rows on this page per currency - each row is in its tenant's own currency, and INR + USD
   * can't be added into one honest number. Refunds are negative, so this is money kept, not money taken. */
  get pageTotals(): { currencyCode: string; currencySymbol: string; amount: number; amountUsd: number }[] {
    const byCurrency = new Map<string, { currencyCode: string; currencySymbol: string; amount: number; amountUsd: number }>();
    for (const row of this.page.items) {
      const entry = byCurrency.get(row.currencyCode) ?? {
        currencyCode: row.currencyCode,
        currencySymbol: row.currencySymbol,
        amount: 0,
        amountUsd: 0,
      };
      entry.amount += row.localAmount;
      entry.amountUsd += row.amountCents / 100;
      byCurrency.set(row.currencyCode, entry);
    }
    return [...byCurrency.values()];
  }
}

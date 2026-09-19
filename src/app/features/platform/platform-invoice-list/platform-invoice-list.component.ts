import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { formatCharge } from '../../../core/models/billing.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  INVOICE_STATUS_LABELS,
  InvoiceStatus,
  PlatformInvoiceListItem,
  PlatformInvoiceQuery,
  formatInvoicePeriod,
  formatInvoicePeriodRange,
} from '../../../core/models/platform.model';
import { PlatformInvoiceService } from '../../../core/services/platform-invoice.service';

@Component({
  selector: 'app-platform-invoice-list',
  templateUrl: './platform-invoice-list.component.html',
  styleUrls: ['./platform-invoice-list.component.scss'],
})
export class PlatformInvoiceListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['tenant', 'period', 'plan', 'total', 'status', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusLabels = INVOICE_STATUS_LABELS;
  readonly InvoiceStatus = InvoiceStatus;
  readonly formatCharge = formatCharge;
  readonly formatInvoicePeriod = formatInvoicePeriod;
  readonly formatInvoicePeriodRange = formatInvoicePeriodRange;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly statusControl = new FormControl<InvoiceStatus | ''>('', { nonNullable: true });

  page: PagedResult<PlatformInvoiceListItem> = emptyPage<PlatformInvoiceListItem>();
  loading = true;

  private query: PlatformInvoiceQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly invoices: PlatformInvoiceService) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.statusControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((status) => {
      // status === '' rather than a truthy check - InvoiceStatus.Due is 0, which is falsy.
      this.query = { ...this.query, page: 1, status: status === '' ? undefined : status };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.invoices.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformInvoiceListItem>(this.query.pageSize))),
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

  /** Totals the rows on the current page per currency - each row is quoted in its tenant's own
   * country currency, and INR + USD can't be added into one honest number. */
  get pageTotals(): { currencyCode: string; currencySymbol: string; amount: number; amountUsd: number }[] {
    const byCurrency = new Map<string, { currencyCode: string; currencySymbol: string; amount: number; amountUsd: number }>();
    for (const row of this.page.items) {
      const entry = byCurrency.get(row.currencyCode) ?? {
        currencyCode: row.currencyCode,
        currencySymbol: row.currencySymbol,
        amount: 0,
        amountUsd: 0,
      };
      entry.amount += row.totalAmountLocal;
      entry.amountUsd += row.totalAmountUsd;
      byCurrency.set(row.currencyCode, entry);
    }
    return [...byCurrency.values()];
  }

  /** A method rather than indexing `statusLabels[row.status]` directly in the template - the table
   * row's `status` doesn't narrow to InvoiceStatus inside a *matCellDef context, the same reason
   * PlatformTenantDetailComponent.outcomeLabel exists. */
  statusLabel(status: InvoiceStatus): string {
    return this.statusLabels[status];
  }
}

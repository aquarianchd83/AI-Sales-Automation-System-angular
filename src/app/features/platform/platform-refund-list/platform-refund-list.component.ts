import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { REFUND_STATUS_LABELS, RefundRequest, RefundStatus } from '../../../core/models/billing.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { PlatformRefundQuery, PlatformRefundService } from '../../../core/services/platform-refund.service';
import { PlatformRefundReviewDialogComponent } from '../platform-refund-review-dialog/platform-refund-review-dialog.component';

/**
 * The refund queue. Defaults to what needs a decision (Waiting for review) and never approves anything by
 * itself - every row is approved, partly approved or declined by a person, and a payout that failed at the
 * gateway sits here with a retry until someone deals with it.
 */
@Component({
  selector: 'app-platform-refund-list',
  templateUrl: './platform-refund-list.component.html',
  styleUrls: ['./platform-refund-list.component.scss'],
})
export class PlatformRefundListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['tenant', 'payment', 'reason', 'amount', 'asked', 'status', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly RefundStatus = RefundStatus;
  readonly statusOptions = [
    RefundStatus.Requested,
    RefundStatus.Failed,
    RefundStatus.Refunded,
    RefundStatus.Rejected,
    RefundStatus.Cancelled,
    RefundStatus.Expired,
  ];
  /** '' is "all" - a sentinel, because RefundStatus.Requested is 0 and a truthy check would drop it. */
  readonly statusControl = new FormControl<RefundStatus | ''>(RefundStatus.Requested, { nonNullable: true });

  page: PagedResult<RefundRequest> = emptyPage<RefundRequest>();
  loading = true;

  private query: PlatformRefundQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE, status: RefundStatus.Requested };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly refunds: PlatformRefundService, private readonly dialog: MatDialog) {}

  ngOnInit(): void {
    this.statusControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.query = { ...this.query, page: 1, status: status === '' ? undefined : status };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.refunds.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<RefundRequest>(this.query.pageSize))),
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

  statusLabel(status: RefundStatus): string {
    return REFUND_STATUS_LABELS[status];
  }

  /** A request can be decided while it waits, or retried after a failed payout. */
  isOpen(request: RefundRequest): boolean {
    return request.status === RefundStatus.Requested || request.status === RefundStatus.Failed;
  }

  review(request: RefundRequest, mode: 'approve' | 'reject'): void {
    this.dialog
      .open(PlatformRefundReviewDialogComponent, { data: { mode, request }, width: '520px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.reload$.next();
        }
      });
  }
}

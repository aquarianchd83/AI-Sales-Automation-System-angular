import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import {
  LEAD_DISCOVERY_EXECUTION_STATUSES,
  LeadDiscoveryExecutionSummary,
  LeadDiscoveryHistoryDay,
  LeadDiscoveryHistoryQuery,
  leadDiscoveryStatusChipClass,
} from '../../../core/models/lead-discovery-history.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LeadDiscoveryExecutionDetailDialogComponent } from '../lead-discovery-execution-detail-dialog/lead-discovery-execution-detail-dialog.component';

/**
 * Lead Discovery History: every lead-discovery execution, grouped by processing date (newest date
 * first) — customer counts, Auto-Campaign/template/mapping outcome, retry state and lock status. A
 * retryable execution (RetryPending/PartiallyCompleted/Failed, not yet superseded) can be retried from
 * here; it runs as a new execution with its own Execution ID. Admin only.
 */
@Component({
  selector: 'app-lead-discovery-history-list',
  templateUrl: './lead-discovery-history-list.component.html',
  styleUrls: ['./lead-discovery-history-list.component.scss'],
})
export class LeadDiscoveryHistoryListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusOptions = LEAD_DISCOVERY_EXECUTION_STATUSES;
  readonly chipClass = leadDiscoveryStatusChipClass;
  readonly statusControl = new FormControl<string | null>(null);

  page: PagedResult<LeadDiscoveryHistoryDay> = emptyPage<LeadDiscoveryHistoryDay>();
  loading = true;
  failed = false;
  /** Execution ids currently being retried — disables their retry button until the request settles. */
  readonly retrying = new Set<string>();

  private pageIndex = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly leadDiscovery: LeadDiscoveryService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.statusControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.pageIndex = 1;
      this.reload$.next();
    });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          this.failed = false;
          return this.leadDiscovery.getHistory(this.buildQuery()).pipe(
            catchError(() => {
              this.failed = true;
              return of(emptyPage<LeadDiscoveryHistoryDay>(this.pageSize));
            }),
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
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.reload$.next();
  }

  viewExecution(execution: LeadDiscoveryExecutionSummary): void {
    this.dialog.open(LeadDiscoveryExecutionDetailDialogComponent, {
      data: { executionId: execution.id },
      width: '760px',
      maxWidth: '95vw',
    });
  }

  retry(execution: LeadDiscoveryExecutionSummary, event: Event): void {
    event.stopPropagation();
    if (this.retrying.has(execution.id)) {
      return;
    }
    this.retrying.add(execution.id);
    this.leadDiscovery
      .retryExecution(execution.id)
      .pipe(finalize(() => this.retrying.delete(execution.id)))
      .subscribe({
        next: () => {
          this.notify.success('Retry queued — it will run as a new execution.');
          this.reload$.next();
        },
        error: (err) => {
          const message = err?.error?.message || err?.error?.detail || 'This execution could not be retried.';
          this.notify.error(message);
        },
      });
  }

  /** A short, readable label for the retry-chain relationship shown under the trigger column. */
  chainLabel(execution: LeadDiscoveryExecutionSummary): string | null {
    if (execution.retryOfExecutionId) {
      return `Retry attempt ${execution.retryCount}`;
    }
    return null;
  }

  private buildQuery(): LeadDiscoveryHistoryQuery {
    return {
      page: this.pageIndex,
      pageSize: this.pageSize,
      status: this.statusControl.value || undefined,
    };
  }
}

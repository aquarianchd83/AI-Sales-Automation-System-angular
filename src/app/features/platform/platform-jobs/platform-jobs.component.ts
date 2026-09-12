import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PagedResult,
  emptyPage,
} from '../../../core/models/paged-result.model';
import {
  PlatformGlobalJob,
  PlatformJobQuery,
  PlatformTenantJob,
  TENANT_JOB_RUN_OUTCOME_LABELS,
  TENANT_STATUS_LABELS,
  TenantJobDefinition,
  TenantJobRunOutcome,
  TenantStatus,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformJobService } from '../../../core/services/platform-job.service';
import { PlatformJobScheduleDialogComponent } from '../platform-job-schedule-dialog/platform-job-schedule-dialog.component';

/** The three ways an operator wants to narrow this list, collapsed into one select. "Failing" is the
 * reason this screen gets opened, so it is a first-class filter rather than something to eyeball. */
type StateFilter = 'all' | 'enabled' | 'paused' | 'failing';

@Component({
  selector: 'app-platform-jobs',
  templateUrl: './platform-jobs.component.html',
  styleUrls: ['./platform-jobs.component.scss'],
})
export class PlatformJobsComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['tenant', 'job', 'schedule', 'state', 'lastRun', 'nextRun', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusLabels = TENANT_STATUS_LABELS;
  readonly TenantJobRunOutcome = TenantJobRunOutcome;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly jobTypeControl = new FormControl<string>('', { nonNullable: true });
  readonly stateControl = new FormControl<StateFilter>('all', { nonNullable: true });

  catalog: TenantJobDefinition[] = [];
  platformJobs: PlatformGlobalJob[] = [];
  page: PagedResult<PlatformTenantJob> = emptyPage<PlatformTenantJob>();
  loading = true;
  reconciling = false;

  /** Job types with an action in flight, keyed by `{tenantId}:{jobType}` — so a slow "Run now" only
   * disables its own row's buttons instead of the whole table. */
  private readonly busy = new Set<string>();

  private query: PlatformJobQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly jobs: PlatformJobService,
    private readonly route: ActivatedRoute,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    // Deep-linked from a tenant's own detail screen ("Manage jobs"), so that link lands on this list
    // already narrowed to that tenant rather than on every tenant's jobs.
    const tenantId = this.route.snapshot.queryParamMap.get('tenantId');
    if (tenantId) {
      this.query = { ...this.query, tenantId };
    }

    this.jobs.getCatalog().subscribe({ next: (catalog) => (this.catalog = catalog) });
    this.loadPlatformJobs();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => this.applyFilters({ search: search || undefined }));

    this.jobTypeControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((jobType) => this.applyFilters({ jobType: jobType || undefined }));

    this.stateControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => this.applyFilters(stateToQuery(state)));

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.jobs.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformTenantJob>(this.query.pageSize))),
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

  get tenantFilter(): string | undefined {
    return this.query.tenantId;
  }

  /** The name of the tenant the list is pinned to, for the "showing one tenant" chip. Read off the
   * rows rather than fetched — if the filter matched nothing there is no name to show anyway. */
  get tenantFilterName(): string {
    return this.page.items[0]?.tenantName ?? 'this tenant';
  }

  clearTenantFilter(): void {
    this.applyFilters({ tenantId: undefined });
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  isBusy(job: PlatformTenantJob): boolean {
    return this.busy.has(keyOf(job));
  }

  /** Methods rather than template-level `statusLabels[...]`/`outcomeLabels[...]` indexes, for the
   * reason PlatformTenantListComponent.statusLabel already documents: mat-table row bindings infer as
   * `any`, and TS7053 refuses to index an enum-keyed Record with an `any` key. `lastRunOutcome` is
   * nullable on top of that, hence the '' for a job that has never run. */
  statusLabel(status: TenantStatus): string {
    return this.statusLabels[status];
  }

  outcomeLabel(outcome: TenantJobRunOutcome | null): string {
    return outcome == null ? '' : TENANT_JOB_RUN_OUTCOME_LABELS[outcome];
  }

  /** Mirrors the server's TenantStatusRules whitelist. A job on an ineligible tenant cannot be run or
   * registered, so its Run now button is disabled and its state cell explains why. */
  runsJobs(job: PlatformTenantJob): boolean {
    return job.tenantStatus === TenantStatus.Trial || job.tenantStatus === TenantStatus.Active;
  }

  editSchedule(job: PlatformTenantJob): void {
    this.dialog
      .open(PlatformJobScheduleDialogComponent, { data: { job }, width: '520px' })
      .afterClosed()
      .subscribe((updated?: PlatformTenantJob | null) => {
        if (updated) {
          this.replaceRow(updated);
        }
      });
  }

  /** Pause/resume without opening the dialog — the common action, and the one an operator reaches for
   * while something is misbehaving. Keeps the cron exactly as it was. */
  toggleEnabled(job: PlatformTenantJob): void {
    this.runAction(job, () =>
      this.jobs.updateSchedule(job.tenantId, job.jobType, {
        cronExpression: job.cronExpression,
        isEnabled: !job.isEnabled,
      })
    ).subscribe((updated) => {
      this.replaceRow(updated);
      this.notify.success(
        `${updated.displayName} ${updated.isEnabled ? 'resumed' : 'paused'} for ${updated.tenantName}.`
      );
    });
  }

  runNow(job: PlatformTenantJob): void {
    this.runAction(job, () => this.jobs.trigger(job.tenantId, job.jobType)).subscribe((result) => {
      this.notify.success(
        `${job.displayName} queued for ${job.tenantName} (Hangfire job ${result.backgroundJobId}).`
      );
      // The run is asynchronous, so the row's own last-run fields will not be current for a few
      // seconds. Reloading the page here would show stale values and look like nothing happened;
      // the operator refreshes (or watches the row's next scheduled run) instead.
    });
  }

  /** Rebuilds every tenant's Hangfire registrations from the schedule table. Same pass that runs at
   * startup and hourly — this is the "it looks wrong, put it back" button, so no confirmation: it is
   * idempotent and changes nothing when everything already matches. */
  reconcile(): void {
    if (this.reconciling) {
      return;
    }

    this.reconciling = true;
    this.jobs
      .reconcile()
      .pipe(finalize(() => (this.reconciling = false)))
      .subscribe({
        next: (summary) => {
          this.notify.success(
            `Reconciled ${summary.tenantsExamined} tenant(s): ${summary.jobsRegistered} registered, ` +
              `${summary.jobsRemoved} removed, ${summary.schedulesCreated} schedule(s) created, ` +
              `${summary.orphanRegistrationsRemoved} orphan(s) cleared.`
          );
          this.loadPlatformJobs();
          this.reload$.next();
        },
        error: () => {
          /* ErrorInterceptor toasts it */
        },
      });
  }

  private applyFilters(patch: Partial<PlatformJobQuery>): void {
    this.query = { ...this.query, ...patch, page: 1 };
    this.paginator?.firstPage();
    this.reload$.next();
  }

  private loadPlatformJobs(): void {
    this.jobs.getPlatformJobs().subscribe({ next: (jobs) => (this.platformJobs = jobs) });
  }

  /** Marks one row busy for the duration of a call, and swallows the error case so subscribers only
   * ever see success — the ErrorInterceptor has already toasted the failure, and every caller here
   * would otherwise need the same empty error handler. */
  private runAction<T>(job: PlatformTenantJob, action: () => Observable<T>): Observable<T> {
    const key = keyOf(job);
    this.busy.add(key);

    return action().pipe(
      catchError(() => of(null)),
      finalize(() => this.busy.delete(key)),
      filter((result): result is T => result != null)
    );
  }

  /** Swaps one row in place instead of refetching the page — a reload would re-sort (failing first)
   * and could move the row the operator just acted on out from under them. */
  private replaceRow(updated: PlatformTenantJob): void {
    this.page = {
      ...this.page,
      items: this.page.items.map((row) =>
        row.tenantId === updated.tenantId && row.jobType === updated.jobType ? updated : row
      ),
    };
  }
}

function keyOf(job: PlatformTenantJob): string {
  return `${job.tenantId}:${job.jobType}`;
}

function stateToQuery(state: StateFilter): Partial<PlatformJobQuery> {
  switch (state) {
    case 'enabled':
      return { isEnabled: true, failingOnly: undefined };
    case 'paused':
      return { isEnabled: false, failingOnly: undefined };
    case 'failing':
      return { isEnabled: undefined, failingOnly: true };
    default:
      return { isEnabled: undefined, failingOnly: undefined };
  }
}

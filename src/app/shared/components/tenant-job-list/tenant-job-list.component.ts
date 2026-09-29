import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, of } from 'rxjs';
import { catchError, filter, finalize, takeUntil } from 'rxjs/operators';

import { TENANT_JOB_RUN_OUTCOME_LABELS, TenantJob, TenantJobRunOutcome } from '../../../core/models/tenant-job.model';
import { NotificationHubService } from '../../../core/services/notification-hub.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantJobService } from '../../../core/services/tenant-job.service';
import {
  TenantJobScheduleDialogComponent,
  TenantJobScheduleDialogData,
} from '../tenant-job-schedule-dialog/tenant-job-schedule-dialog.component';

/** Background jobs your own workspace runs — campaign sending and lead discovery. WhatsApp
 * integration jobs (template sync, token refresh) aren't here: they're platform-managed, since a wrong
 * schedule there can silently break your WhatsApp connection rather than just your own campaigns. */
@Component({
  selector: 'app-tenant-job-list',
  templateUrl: './tenant-job-list.component.html',
  styleUrls: ['./tenant-job-list.component.scss'],
})
export class TenantJobListComponent implements OnInit, OnDestroy {
  /** Only list these job types (e.g. CAMPAIGN_JOB_TYPES); null lists every job the tenant can manage. */
  @Input() jobTypes: readonly string[] | null = null;
  /** Drop the page chrome (header, back link, page padding) so the table can sit inside another page. */
  @Input() embedded = false;

  readonly displayedColumns = ['job', 'schedule', 'state', 'lastRun', 'nextRun', 'actions'];
  readonly outcomeLabels = TENANT_JOB_RUN_OUTCOME_LABELS;
  readonly TenantJobRunOutcome = TenantJobRunOutcome;

  jobs: TenantJob[] = [];
  runsBackgroundJobs = true;
  loading = true;
  loadFailed = false;

  /** Job types with an action in flight, so a slow "Run now" only disables its own row's buttons. */
  private readonly busy = new Set<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly jobService: TenantJobService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly notificationHub: NotificationHubService
  ) {}

  ngOnInit(): void {
    this.load();

    // A job in this list just finished a run, so its last-run and next-run cells are stale: refresh the
    // rows in place, without the spinner or the error card, so the table doesn't flash.
    this.notificationHub
      .jobFinished(this.jobTypes ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.load(true));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(silent = false): void {
    if (!silent) {
      this.loading = true;
      this.loadFailed = false;
    }
    this.jobService.getJobs().subscribe({
      next: (result) => {
        const wanted = this.jobTypes;
        this.jobs = wanted ? result.jobs.filter((job) => wanted.includes(job.jobType)) : result.jobs;
        this.runsBackgroundJobs = result.runsBackgroundJobs;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        if (!silent) {
          this.loadFailed = true;
        }
      },
    });
  }

  isBusy(job: TenantJob): boolean {
    return this.busy.has(job.jobType);
  }

  outcomeLabel(outcome: TenantJobRunOutcome | null): string {
    return outcome == null ? '' : this.outcomeLabels[outcome];
  }

  outcomeChipClass(outcome: TenantJobRunOutcome | null): string {
    switch (outcome) {
      case TenantJobRunOutcome.Succeeded:
        return 'status-chip status-chip--running';
      case TenantJobRunOutcome.Failed:
        return 'status-chip status-chip--stopped';
      default:
        return 'status-chip status-chip--draft';
    }
  }

  editSchedule(job: TenantJob): void {
    const data: TenantJobScheduleDialogData = { job, runsBackgroundJobs: this.runsBackgroundJobs };
    this.dialog
      .open(TenantJobScheduleDialogComponent, { data, width: '520px' })
      .afterClosed()
      .subscribe((updated?: TenantJob | null) => {
        if (updated) {
          this.replaceRow(updated);
        }
      });
  }

  /** Pause/resume without opening the dialog — keeps the cron exactly as it was. */
  toggleEnabled(job: TenantJob): void {
    this.runAction(job, () =>
      this.jobService.updateSchedule(job.jobType, {
        cronExpression: job.cronExpression,
        isEnabled: !job.isEnabled,
      })
    ).subscribe((updated) => {
      this.replaceRow(updated);
      this.notify.success(`${updated.displayName} ${updated.isEnabled ? 'resumed' : 'paused'}.`);
    });
  }

  runNow(job: TenantJob): void {
    this.runAction(job, () => this.jobService.trigger(job.jobType)).subscribe((result) => {
      this.notify.success(`${job.displayName} queued (job ${result.backgroundJobId}).`);
      // The run is asynchronous, so this row's last-run fields won't be current for a few seconds -
      // refresh (or wait for the next scheduled run) to see the outcome.
    });
  }

  private runAction<T>(job: TenantJob, action: () => Observable<T>): Observable<T> {
    this.busy.add(job.jobType);

    return action().pipe(
      catchError(() => of(null)),
      finalize(() => this.busy.delete(job.jobType)),
      filter((result): result is T => result != null)
    );
  }

  private replaceRow(updated: TenantJob): void {
    this.jobs = this.jobs.map((row) => (row.jobType === updated.jobType ? updated : row));
  }
}

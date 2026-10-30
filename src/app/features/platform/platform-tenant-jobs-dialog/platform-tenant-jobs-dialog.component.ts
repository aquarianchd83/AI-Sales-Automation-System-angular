import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { catchError, filter, finalize } from 'rxjs/operators';

import {
  PlatformTenantJob,
  TENANT_JOB_RUN_OUTCOME_LABELS,
  TENANT_STATUS_LABELS,
  TenantJobRunOutcome,
  TenantStatus,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformJobService } from '../../../core/services/platform-job.service';
import { PlatformJobScheduleDialogComponent } from '../platform-job-schedule-dialog/platform-job-schedule-dialog.component';

export interface PlatformTenantJobsDialogData {
  tenantId: string;
  tenantName: string;
}

/** One tenant's background jobs, opened from the Jobs button on its detail page, with the same actions as the Jobs screen:
 * run now, pause or resume, and edit the schedule. Every job of the tenant is listed (there are only a handful). */
@Component({
  selector: 'app-platform-tenant-jobs-dialog',
  template: `
    <h2 mat-dialog-title>Background jobs — {{ data.tenantName }}</h2>
    <mat-dialog-content>
      <p class="muted intro">Each job runs on this tenant's own schedule. Only a PlatformSuperAdmin can change, pause or run them.</p>
      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>
      <p class="muted" *ngIf="!loading && !jobs.length">No jobs found for this tenant.</p>
      <p class="muted hint" *ngIf="jobs.length && !runsJobs(jobs[0])">
        This tenant is {{ statusLabel(jobs[0].tenantStatus) }}, so none of its jobs are registered — the schedules are kept and restored
        if it is reactivated.
      </p>

      <div class="table-scroll" *ngIf="jobs.length">
        <table mat-table [dataSource]="jobs">
          <ng-container matColumnDef="job">
            <th mat-header-cell *matHeaderCellDef>Job</th>
            <td mat-cell *matCellDef="let row">
              <span [matTooltip]="row.description">{{ row.displayName }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="schedule">
            <th mat-header-cell *matHeaderCellDef>Schedule</th>
            <td mat-cell *matCellDef="let row">
              <code class="cron">{{ row.cronExpression }}</code>
              <div class="muted sub" *ngIf="row.cronExpression !== row.defaultCron">default {{ row.defaultCron }}</div>
            </td>
          </ng-container>

          <ng-container matColumnDef="state">
            <th mat-header-cell *matHeaderCellDef>State</th>
            <td mat-cell *matCellDef="let row">
              <ng-container *ngIf="row.isEnabled; else paused">
                <span class="state state-on" *ngIf="row.isRegistered">Running</span>
                <span
                  class="state state-blocked"
                  *ngIf="!row.isRegistered"
                  [matTooltip]="runsJobs(row) ? 'Enabled but not registered with Hangfire — try Reconcile on the Jobs screen.' : 'The tenant is ' + statusLabel(row.tenantStatus) + ', so its jobs do not run.'"
                >
                  Not running
                </span>
              </ng-container>
              <ng-template #paused><span class="state state-off">Paused</span></ng-template>
              <div class="muted sub failure" *ngIf="row.consecutiveFailureCount">
                {{ row.consecutiveFailureCount }} consecutive failure{{ row.consecutiveFailureCount === 1 ? '' : 's' }}
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="lastRun">
            <th mat-header-cell *matHeaderCellDef>Last run</th>
            <td mat-cell *matCellDef="let row">
              <ng-container *ngIf="row.lastRunAtUtc; else neverRun">
                <span
                  class="outcome"
                  [class.outcome-failed]="row.lastRunOutcome === TenantJobRunOutcome.Failed"
                  [class.outcome-skipped]="row.lastRunOutcome === TenantJobRunOutcome.Skipped"
                >
                  {{ outcomeLabel(row.lastRunOutcome) }}
                </span>
                <div class="muted sub">
                  {{ row.lastRunAtUtc | zonedDate: 'medium' }}
                  <ng-container *ngIf="row.lastRunDurationMs != null"> · {{ row.lastRunDurationMs }} ms</ng-container>
                </div>
                <div class="muted sub summary" *ngIf="row.lastRunSummary" [matTooltip]="row.lastRunSummary">{{ row.lastRunSummary }}</div>
              </ng-container>
              <ng-template #neverRun><span class="muted">Never</span></ng-template>
            </td>
          </ng-container>

          <ng-container matColumnDef="nextRun">
            <th mat-header-cell *matHeaderCellDef>Next run</th>
            <td mat-cell *matCellDef="let row">{{ row.nextExecutionUtc ? (row.nextExecutionUtc | zonedDate: 'medium') : '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-header">Actions</th>
            <td mat-cell *matCellDef="let row" class="actions-cell">
              <button
                mat-icon-button
                type="button"
                matTooltip="Run now"
                [disabled]="isBusy(row) || !row.isEnabled || !runsJobs(row)"
                (click)="runNow(row)"
              >
                <mat-icon>play_arrow</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                [matTooltip]="row.isEnabled ? 'Pause for this tenant' : 'Resume for this tenant'"
                [disabled]="isBusy(row)"
                (click)="toggleEnabled(row)"
              >
                <mat-icon>{{ row.isEnabled ? 'pause' : 'play_circle_outline' }}</mat-icon>
              </button>
              <button mat-icon-button type="button" matTooltip="Edit schedule" [disabled]="isBusy(row)" (click)="editSchedule(row)">
                <mat-icon>schedule</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" [class.row-failing]="row.consecutiveFailureCount"></tr>
        </table>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a mat-stroked-button color="primary" mat-dialog-close [routerLink]="['/platform/jobs']" [queryParams]="{ tenantId: data.tenantId }">
        Open Jobs screen
      </a>
      <button mat-button type="button" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        max-height: 70vh;
      }
      .intro {
        margin: 0 0 12px;
        font-size: 13px;
      }
      .hint {
        margin: 0 0 12px;
        font-size: 12px;
      }
      .table-scroll {
        overflow-x: auto;
      }
      table {
        width: 100%;
        min-width: 860px;
      }
      .cron {
        font-family: 'Roboto Mono', 'Consolas', monospace;
        white-space: nowrap;
      }
      .sub {
        font-size: 11px;
        line-height: 1.4;
      }
      .summary {
        max-width: 26ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .state,
      .outcome {
        font-size: 12px;
        font-weight: 600;
      }
      .state-on {
        color: #1b5e20;
      }
      .state-off {
        color: rgba(0, 0, 0, 0.6);
      }
      .state-blocked,
      .failure,
      .outcome-failed {
        color: #b71c1c;
      }
      .outcome-skipped {
        color: #ef6c00;
        font-weight: 500;
      }
      .row-failing td {
        background: rgba(183, 28, 28, 0.04);
      }
      .actions-header,
      .actions-cell {
        text-align: right;
        white-space: nowrap;
      }
      .mat-column-nextRun,
      .mat-column-lastRun .sub {
        white-space: nowrap;
      }
    `,
  ],
})
export class PlatformTenantJobsDialogComponent implements OnInit {
  /** Wide enough for the whole table at once, like the Jobs screen. */
  static readonly config = { width: '1100px', maxWidth: '96vw' } as const;

  readonly columns = ['job', 'schedule', 'state', 'lastRun', 'nextRun', 'actions'];
  readonly TenantJobRunOutcome = TenantJobRunOutcome;

  jobs: PlatformTenantJob[] = [];
  loading = true;

  /** Jobs with an action in flight, so a slow "Run now" only disables its own row. */
  private readonly busy = new Set<string>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformTenantJobsDialogData,
    private readonly jobService: PlatformJobService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.jobService
      .getPaged({ tenantId: this.data.tenantId, page: 1, pageSize: 100 })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (page) => (this.jobs = page.items), error: () => (this.jobs = []) });
  }

  isBusy(job: PlatformTenantJob): boolean {
    return this.busy.has(job.jobType);
  }

  /** Methods rather than template-level index lookups, for the reason PlatformJobsComponent documents (row bindings infer as `any`). */
  statusLabel(status: TenantStatus): string {
    return TENANT_STATUS_LABELS[status];
  }

  outcomeLabel(outcome: TenantJobRunOutcome | null): string {
    return outcome == null ? '' : TENANT_JOB_RUN_OUTCOME_LABELS[outcome];
  }

  /** Mirrors the server's TenantStatusRules whitelist: a job of an ineligible tenant cannot be run or registered. */
  runsJobs(job: PlatformTenantJob): boolean {
    return job.tenantStatus === TenantStatus.Trial || job.tenantStatus === TenantStatus.Active;
  }

  runNow(job: PlatformTenantJob): void {
    this.act(job, () => this.jobService.trigger(job.tenantId, job.jobType)).subscribe((result) =>
      this.notify.success(`${job.displayName} queued (Hangfire job ${result.backgroundJobId}).`)
    );
  }

  /** Pause or resume without opening the schedule dialog; keeps the cron exactly as it was. */
  toggleEnabled(job: PlatformTenantJob): void {
    this.act(job, () =>
      this.jobService.updateSchedule(job.tenantId, job.jobType, { cronExpression: job.cronExpression, isEnabled: !job.isEnabled })
    ).subscribe((updated) => {
      this.replace(updated);
      this.notify.success(`${updated.displayName} ${updated.isEnabled ? 'resumed' : 'paused'}.`);
    });
  }

  editSchedule(job: PlatformTenantJob): void {
    this.dialog
      .open(PlatformJobScheduleDialogComponent, { data: { job }, width: '520px' })
      .afterClosed()
      .subscribe((updated?: PlatformTenantJob | null) => {
        if (updated) {
          this.replace(updated);
        }
      });
  }

  /** Marks one job busy for the call and swallows the error case (the ErrorInterceptor has already toasted it). */
  private act<T>(job: PlatformTenantJob, action: () => Observable<T>): Observable<T> {
    this.busy.add(job.jobType);
    return action().pipe(
      catchError(() => of(null)),
      finalize(() => this.busy.delete(job.jobType)),
      filter((result): result is T => result != null)
    );
  }

  /** Swaps one row in place so the row just acted on does not move. */
  private replace(updated: PlatformTenantJob): void {
    this.jobs = this.jobs.map((row) => (row.jobType === updated.jobType ? updated : row));
  }
}

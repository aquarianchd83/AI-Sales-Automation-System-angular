import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { TenantJob } from '../../../core/models/tenant-job.model';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantJobService } from '../../../core/services/tenant-job.service';

export interface TenantJobScheduleDialogData {
  job: TenantJob;
  /** TenantJobs.runsBackgroundJobs — false only when this tenant's own account status makes every job
   * ineligible right now, whatever is set here. */
  runsBackgroundJobs: boolean;
}

/** A cron you can pick without writing one. Anything else is typed into the field, which the server
 * validates with the same parser Hangfire uses, so a wrong expression is a 400 here rather than a job
 * that silently never fires. */
interface CronPreset {
  label: string;
  cron: string;
}

/**
 * Editor for one of this tenant's own campaign-sending or lead-discovery job schedules. Saving
 * re-registers the job with Hangfire server-side as part of the same request, so the row returned is
 * already the post-change truth — including `isRegistered`.
 */
@Component({
  selector: 'app-tenant-job-schedule-dialog',
  templateUrl: './tenant-job-schedule-dialog.component.html',
  styleUrls: ['./tenant-job-schedule-dialog.component.scss'],
})
export class TenantJobScheduleDialogComponent {
  readonly presets: CronPreset[] = [
    { label: 'Every minute', cron: '* * * * *' },
    { label: 'Every 5 minutes', cron: '*/5 * * * *' },
    { label: 'Every 15 minutes', cron: '*/15 * * * *' },
    { label: 'Hourly', cron: '0 * * * *' },
    { label: 'Every 6 hours', cron: '0 */6 * * *' },
    { label: 'Daily at midnight', cron: '0 0 * * *' },
  ];

  readonly form = this.fb.group({
    cronExpression: [this.data.job.cronExpression, [Validators.required, Validators.maxLength(100)]],
    isEnabled: [this.data.job.isEnabled],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly jobs: TenantJobService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<TenantJobScheduleDialogComponent, TenantJob | null>,
    @Inject(MAT_DIALOG_DATA) public readonly data: TenantJobScheduleDialogData
  ) {}

  get isDefaultCron(): boolean {
    return this.form.controls.cronExpression.value.trim() === this.data.job.defaultCron;
  }

  applyPreset(cron: string): void {
    this.form.controls.cronExpression.setValue(cron);
    this.form.controls.cronExpression.markAsDirty();
  }

  resetToDefault(): void {
    this.applyPreset(this.data.job.defaultCron);
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving = true;
    this.jobs
      .updateSchedule(this.data.job.jobType, {
        cronExpression: raw.cronExpression.trim(),
        isEnabled: raw.isEnabled,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (job) => {
          this.notify.success(`${job.displayName} schedule saved.`);
          this.dialogRef.close(job);
        },
        // An invalid cron comes back as a 400 the ErrorInterceptor toasts; keep the dialog open so the
        // caller can correct the expression rather than retype the whole thing.
      });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}

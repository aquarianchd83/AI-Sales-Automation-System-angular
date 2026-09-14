import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { PlatformTenantJob, TenantStatus } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformJobService } from '../../../core/services/platform-job.service';

export interface PlatformJobScheduleDialogData {
  job: PlatformTenantJob;
}

/** A cron an operator can pick without writing one. Deliberately short — anything else is typed into
 * the field, which the server validates with the same parser Hangfire uses, so a wrong expression is
 * a 400 here rather than a job that silently never fires. */
interface CronPreset {
  label: string;
  cron: string;
}

/**
 * PlatformSuperAdmin-only editor for one tenant's schedule for one background job. Saving re-registers
 * the job with Hangfire server-side as part of the same request, so the row the caller gets back is
 * already the post-change truth — including `isRegistered`, which stays false when the tenant's status
 * makes it ineligible no matter what was just enabled here.
 */
@Component({
  selector: 'app-platform-job-schedule-dialog',
  templateUrl: './platform-job-schedule-dialog.component.html',
  styleUrls: ['./platform-job-schedule-dialog.component.scss'],
})
export class PlatformJobScheduleDialogComponent {
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
    private readonly jobs: PlatformJobService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformJobScheduleDialogComponent, PlatformTenantJob | null>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformJobScheduleDialogData
  ) {}

  get isDefaultCron(): boolean {
    return this.form.controls.cronExpression.value.trim() === this.data.job.defaultCron;
  }

  /** Mirrors the server's TenantStatusRules whitelist. Enabling a job for an ineligible tenant is
   * allowed and saved — it just stays unregistered until the tenant is reactivated — so this only
   * drives an explanatory note, never a disabled control. */
  get tenantRunsJobs(): boolean {
    return this.data.job.tenantStatus === TenantStatus.Trial || this.data.job.tenantStatus === TenantStatus.Active;
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
      .updateSchedule(this.data.job.tenantId, this.data.job.jobType, {
        cronExpression: raw.cronExpression.trim(),
        isEnabled: raw.isEnabled,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (job) => {
          this.notify.success(`${job.displayName} schedule saved for ${job.tenantName}.`);
          this.dialogRef.close(job);
        },
        error: () => {
          // An invalid cron comes back as a 400 the ErrorInterceptor toasts; keep the dialog open so
          // the operator can correct the expression rather than retype the whole thing.
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}

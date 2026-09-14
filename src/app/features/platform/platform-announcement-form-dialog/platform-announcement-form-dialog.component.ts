import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  ANNOUNCEMENT_SEVERITY_LABELS,
  Announcement,
  AnnouncementSeverity,
} from '../../../core/models/platform.model';
import { AnnouncementService } from '../../../core/services/announcement.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface PlatformAnnouncementFormDialogData {
  announcement?: Announcement;
}

@Component({
  selector: 'app-platform-announcement-form-dialog',
  templateUrl: './platform-announcement-form-dialog.component.html',
  styles: [
    `
      .active-toggle {
        display: block;
        margin: 4px 0 8px;
      }
      .note {
        margin: 8px 0 0;
        font-size: 12px;
      }
    `,
  ],
})
export class PlatformAnnouncementFormDialogComponent {
  readonly isEdit = !!this.data.announcement;
  readonly severityOptions = Object.values(AnnouncementSeverity).filter(
    (v): v is AnnouncementSeverity => typeof v === 'number'
  );
  readonly severityLabels = ANNOUNCEMENT_SEVERITY_LABELS;
  saving = false;

  readonly form = this.fb.nonNullable.group({
    title: [this.data.announcement?.title ?? '', [Validators.required, Validators.maxLength(200)]],
    body: [this.data.announcement?.body ?? '', [Validators.required, Validators.maxLength(4000)]],
    severity: [this.data.announcement?.severity ?? AnnouncementSeverity.Info, Validators.required],
    isActive: [this.data.announcement?.isActive ?? true],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly announcements: AnnouncementService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformAnnouncementFormDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformAnnouncementFormDialogData
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving = true;

    const request = this.isEdit
      ? this.announcements.update(this.data.announcement!.id, {
          title: value.title,
          body: value.body,
          severity: value.severity,
          isActive: value.isActive,
          startsAtUtc: this.data.announcement?.startsAtUtc ?? null,
          endsAtUtc: this.data.announcement?.endsAtUtc ?? null,
        })
      : this.announcements.create({ title: value.title, body: value.body, severity: value.severity });

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Announcement updated.' : 'Announcement created.');
        this.dialogRef.close(true);
      },
      error: () => {
        /* ErrorInterceptor toasts it; keep the dialog open */
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

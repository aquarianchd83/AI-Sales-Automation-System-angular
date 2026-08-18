import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { Campaign, toScheduledStartAtRequest, toTimeInputValue } from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface CampaignFormDialogData {
  mode: 'create' | 'edit';
  campaign?: Campaign;
}

@Component({
  selector: 'app-campaign-form-dialog',
  templateUrl: './campaign-form-dialog.component.html',
  styleUrls: ['./campaign-form-dialog.component.scss'],
})
export class CampaignFormDialogComponent {
  readonly isEdit = this.data.mode === 'edit';
  /** The API rejects a scheduled start in the past — only enforced on create. */
  readonly today = new Date();

  private readonly existingScheduledStartAt = this.data.campaign?.scheduledStartAt
    ? new Date(this.data.campaign.scheduledStartAt)
    : null;

  readonly form = this.fb.nonNullable.group({
    name: [this.data.campaign?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    description: [this.data.campaign?.description ?? '', [Validators.maxLength(2000)]],
    scheduledStartAt: [this.existingScheduledStartAt as Date | null],
    /** "HH:mm" — see toTimeInputValue/toScheduledStartAtRequest. Defaults to midnight so a
     * date picked with the time left untouched still schedules exactly as it did before
     * this field existed. */
    scheduledStartTime: [this.existingScheduledStartAt ? toTimeInputValue(this.existingScheduledStartAt) : '00:00'],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CampaignFormDialogData,
    private readonly fb: FormBuilder,
    private readonly campaigns: CampaignService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CampaignFormDialogComponent, boolean>
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request = {
      name: raw.name.trim(),
      description: raw.description.trim() || null,
      scheduledStartAt: raw.scheduledStartAt
        ? toScheduledStartAtRequest(raw.scheduledStartAt, raw.scheduledStartTime)
        : null,
    };

    const saved$: Observable<Campaign> =
      this.isEdit && this.data.campaign
        ? this.campaigns.update(this.data.campaign.id, request)
        : this.campaigns.create(request);

    this.saving = true;
    saved$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Campaign updated.' : 'Campaign created.');
        this.dialogRef.close(true);
      },
      error: () => {
        // ErrorInterceptor toasts it (e.g. editing a campaign that left Draft in another tab).
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

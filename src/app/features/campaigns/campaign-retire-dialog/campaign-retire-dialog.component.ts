import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { Campaign, RETIRE_REASON_MAX_LENGTH } from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface CampaignRetireDialogData {
  campaign: Campaign;
}

/** Asks why a campaign is being retired, then retires it. Closes with the updated campaign, or undefined if cancelled. */
@Component({
  selector: 'app-campaign-retire-dialog',
  templateUrl: './campaign-retire-dialog.component.html',
})
export class CampaignRetireDialogComponent {
  readonly maxLength = RETIRE_REASON_MAX_LENGTH;

  readonly form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(RETIRE_REASON_MAX_LENGTH)]],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CampaignRetireDialogData,
    private readonly fb: FormBuilder,
    private readonly campaigns: CampaignService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CampaignRetireDialogComponent, Campaign | undefined>
  ) {}

  retire(): void {
    const reason = this.form.controls.reason.value.trim();
    if (!reason || this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.campaigns
      .retire(this.data.campaign.id, reason)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (campaign) => {
          this.notify.success('Campaign retired.');
          this.dialogRef.close(campaign);
        },
        error: () => {
          /* ErrorInterceptor toasts it; keep the dialog open */
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}

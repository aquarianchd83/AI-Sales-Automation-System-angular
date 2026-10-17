import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize, switchMap } from 'rxjs/operators';

import { TrialQuotaConfig } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformConfigurationService } from '../../../core/services/platform-configuration.service';

export interface PlatformTrialQuotaDialogData {
  trial: TrialQuotaConfig;
}

/** Edits the free trial allowance. The configuration document is saved whole, so this reads the current one
 * fresh, swaps in the trial block and writes it back - nothing else on the Configuration page is touched. */
@Component({
  selector: 'app-platform-trial-quota-dialog',
  templateUrl: './platform-trial-quota-dialog.component.html',
})
export class PlatformTrialQuotaDialogComponent {
  saving = false;

  readonly form = this.fb.group({
    whatsAppMessages: [this.data.trial.whatsAppMessages, [Validators.required, Validators.min(0)]],
    aiConversations: [this.data.trial.aiConversations, [Validators.required, Validators.min(0)]],
    leadCandidates: [this.data.trial.leadCandidates, [Validators.required, Validators.min(0)]],
  });

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly configuration: PlatformConfigurationService,
    private readonly notify: NotificationService,
    private readonly ref: MatDialogRef<PlatformTrialQuotaDialogComponent, TrialQuotaConfig>,
    @Inject(MAT_DIALOG_DATA) private readonly data: PlatformTrialQuotaDialogData
  ) {}

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const trial = this.form.getRawValue();
    this.saving = true;
    this.configuration
      .get()
      .pipe(
        switchMap((config) => this.configuration.save({ ...config, trial })),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: (saved) => {
          this.notify.success('Trial allowance saved.');
          this.ref.close(saved.trial);
        },
        error: () => this.notify.error('Could not save the trial allowance.'),
      });
  }
}

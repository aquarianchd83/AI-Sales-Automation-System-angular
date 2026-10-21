import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { QUOTA_TYPE_LABELS } from '../../../core/models/billing.model';
import { CreditUsage } from '../../../core/models/credit-payer.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformCreditPayerService } from '../../../core/services/platform-credit-payer.service';

export interface PlatformCreditRedeemDialogData {
  usage: CreditUsage;
}

/** Gives a tenant back what one spend charged it - the goodwill option for when the tenant paid and should not have had to. The tenant is told,
 * and sees the note, so the reason has to be one worth reading. */
@Component({
  selector: 'app-platform-credit-redeem-dialog',
  template: `
    <h2 mat-dialog-title>Give credits back</h2>

    <mat-dialog-content>
      <p>
        Return <strong>{{ data.usage.units | number: '1.0-4' }} {{ labels[data.usage.quotaType] }}</strong> to
        <strong>{{ data.usage.tenantName }}</strong> for "{{ data.usage.scenarioTitle }}".
      </p>
      <p class="muted" *ngIf="data.usage.fellBackToTenant">
        The platform was set to pay for this, but its wallet could not cover it, so the tenant was charged.
      </p>

      <form [formGroup]="form" novalidate>
        <mat-form-field class="full-width">
          <mat-label>Note to the tenant</mat-label>
          <textarea matInput rows="3" maxlength="400" formControlName="note"></textarea>
          <mat-error>Say why the credits are being returned.</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="saving" (click)="submit()">Give back</button>
    </mat-dialog-actions>
  `,
})
export class PlatformCreditRedeemDialogComponent {
  readonly labels = QUOTA_TYPE_LABELS;

  readonly form = this.fb.group({
    note: ['', [Validators.required, Validators.maxLength(400)]],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly credits: PlatformCreditPayerService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformCreditRedeemDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformCreditRedeemDialogData
  ) {}

  submit(): void {
    const note = this.form.controls.note.value.trim();
    if (!note) {
      this.form.controls.note.setErrors({ required: true });
      this.form.controls.note.markAsTouched();
      return;
    }
    if (this.saving) {
      return;
    }

    this.saving = true;
    this.credits
      .redeem(this.data.usage.id, note)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe(() => {
        this.notify.success('Credits returned to the tenant.');
        this.dialogRef.close(true);
      });
  }
}

import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { QuotaType } from '../../../core/models/billing.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformRefundService } from '../../../core/services/platform-refund.service';

export interface PlatformQuotaAdjustDialogData {
  tenantId: string;
  tenantName: string;
}

/** A manual correction to one tenant's credit balance: goodwill credit, or taking back a mistaken grant. The reason is
 * mandatory and goes to both the quota ledger (which the tenant can read) and the audit log. */
@Component({
  selector: 'app-platform-quota-adjust-dialog',
  template: `
    <h2 mat-dialog-title>Adjust credits</h2>

    <mat-dialog-content>
      <p class="muted">{{ data.tenantName }}</p>

      <form [formGroup]="form" novalidate>
        <mat-button-toggle-group formControlName="direction" class="direction" aria-label="Add or remove">
          <mat-button-toggle value="add">Add credits</mat-button-toggle>
          <mat-button-toggle value="remove">Remove credits</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field class="full-width">
          <mat-label>Credits</mat-label>
          <input matInput type="number" min="0.01" step="any" formControlName="units" />
          <mat-error>Enter a number above zero.</mat-error>
        </mat-form-field>

        <mat-form-field class="full-width" *ngIf="form.controls.direction.value === 'add'">
          <mat-label>Valid for (days)</mat-label>
          <input matInput type="number" min="1" max="1095" formControlName="validForDays" />
          <mat-hint>How long the added credits last before they expire.</mat-hint>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Reason</mat-label>
          <textarea matInput rows="2" maxlength="500" formControlName="reason"></textarea>
          <mat-error>A reason is required.</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="saving" (click)="submit()">Apply</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .direction {
        margin-bottom: 16px;
      }
    `,
  ],
})
export class PlatformQuotaAdjustDialogComponent {
  readonly form = this.fb.group({
    direction: ['add' as 'add' | 'remove'],
    units: [0, [Validators.required, Validators.min(0.01)]],
    validForDays: [365, [Validators.min(1), Validators.max(1095)]],
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly refunds: PlatformRefundService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformQuotaAdjustDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformQuotaAdjustDialogData
  ) {}

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (!value.reason.trim()) {
      this.form.controls.reason.setErrors({ required: true });
      this.form.controls.reason.markAsTouched();
      return;
    }

    this.saving = true;
    this.refunds
      .adjustQuota(this.data.tenantId, {
        // There is one wallet.
        quotaType: QuotaType.Credits,
        unitsDelta: value.direction === 'add' ? value.units : -value.units,
        reason: value.reason.trim(),
        validForDays: value.direction === 'add' ? value.validForDays : null,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe(() => {
        this.notify.success('Quota adjusted.');
        this.dialogRef.close(true);
      });
  }
}

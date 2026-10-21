import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { QUOTA_TYPES, QUOTA_TYPE_LABELS, QuotaType } from '../../../core/models/billing.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformCreditPayerService } from '../../../core/services/platform-credit-payer.service';

export interface PlatformCreditWalletDialogData {
  quotaType: QuotaType | null;
}

/** Tops up or corrects the platform's own credit wallet. The reason is mandatory and goes to the wallet ledger and the audit log. */
@Component({
  selector: 'app-platform-credit-wallet-dialog',
  template: `
    <h2 mat-dialog-title>Platform wallet</h2>

    <mat-dialog-content>
      <p class="muted">Credits the platform spends when it pays for a scenario. Tenants are never charged from this balance.</p>

      <form [formGroup]="form" novalidate>
        <mat-form-field class="full-width">
          <mat-label>Credit type</mat-label>
          <mat-select formControlName="quotaType">
            <mat-option *ngFor="let type of quotaTypes" [value]="type">{{ labels[type] }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-button-toggle-group formControlName="direction" class="direction" aria-label="Add or remove">
          <mat-button-toggle value="add">Add credits</mat-button-toggle>
          <mat-button-toggle value="remove">Remove credits</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field class="full-width">
          <mat-label>Credits</mat-label>
          <input matInput type="number" min="0.01" step="any" formControlName="units" />
          <mat-error>Enter a number above zero.</mat-error>
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
export class PlatformCreditWalletDialogComponent {
  readonly quotaTypes = QUOTA_TYPES;
  readonly labels = QUOTA_TYPE_LABELS;

  readonly form = this.fb.group({
    quotaType: [(this.data.quotaType ?? QuotaType.AiConversations) as QuotaType, Validators.required],
    direction: ['add' as 'add' | 'remove'],
    units: [0, [Validators.required, Validators.min(0.01)]],
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly credits: PlatformCreditPayerService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformCreditWalletDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformCreditWalletDialogData
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
    this.credits
      .adjustWallet({
        quotaType: value.quotaType,
        unitsDelta: value.direction === 'add' ? value.units : -value.units,
        reason: value.reason.trim(),
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe(() => {
        this.notify.success('Platform wallet updated.');
        this.dialogRef.close(true);
      });
  }
}

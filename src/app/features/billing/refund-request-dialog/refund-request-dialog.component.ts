import { Component, Inject, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { Payment, RefundEligibility, RefundRequest } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';

export interface RefundRequestDialogData {
  payment: Payment;
}

/**
 * Asks for a refund on one payment. Shows what the rules allow right now (or why nothing can be refunded) before
 * the tenant writes a word, so they never fill in a form that can't succeed. Submitting only files the request -
 * a person at the platform approves or declines it, and nothing is paid out automatically.
 */
@Component({
  selector: 'app-refund-request-dialog',
  template: `
    <h2 mat-dialog-title>Request a refund</h2>

    <mat-dialog-content>
      <p class="muted">{{ data.payment.planName }}</p>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <ng-container *ngIf="eligibility && !loading">
        <div class="verdict verdict--no" *ngIf="!eligibility.eligible">
          <mat-icon>info</mat-icon>
          <span>{{ eligibility.reason || "This payment can't be refunded." }}</span>
        </div>

        <ng-container *ngIf="eligibility.eligible">
          <div class="verdict verdict--yes">
            <mat-icon>check_circle</mat-icon>
            <span>
              You can ask for up to
              <strong>{{ eligibility.currencySymbol }}{{ eligibility.localAmount | number: '1.2-2' }}</strong>
              back.
              <ng-container *ngIf="eligibility.windowEndsAtUtc">
                Refunds for this payment close on {{ eligibility.windowEndsAtUtc | zonedDate: 'mediumDate' }}.
              </ng-container>
            </span>
          </div>

          <p class="muted note">
            Only what's still unused is refundable. Those units are set aside while your request is reviewed, so they
            can't be used until it's decided. Nothing is refunded automatically.
          </p>

          <form [formGroup]="form" novalidate>
            <mat-form-field class="full-width">
              <mat-label>Why are you asking?</mat-label>
              <textarea matInput rows="3" maxlength="1000" formControlName="reason"></textarea>
              <mat-error>Tell us briefly why.</mat-error>
            </mat-form-field>
          </form>
        </ng-container>
      </ng-container>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="null">Close</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        *ngIf="eligibility?.eligible"
        [disabled]="saving"
        (click)="submit()"
      >
        Send request
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .verdict {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
      }
      .verdict--yes {
        background: #e6f4ea;
        color: #1e7e34;
      }
      .verdict--no {
        background: #fff4e5;
        color: #8a4b00;
      }
      .note {
        font-size: 12px;
        margin: 12px 0;
      }
    `,
  ],
})
export class RefundRequestDialogComponent implements OnInit {
  readonly form = this.fb.group({ reason: ['', [Validators.required, Validators.maxLength(1000)]] });

  eligibility: RefundEligibility | null = null;
  loading = true;
  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly billing: BillingService,
    private readonly dialogRef: MatDialogRef<RefundRequestDialogComponent, RefundRequest | null>,
    @Inject(MAT_DIALOG_DATA) public readonly data: RefundRequestDialogData
  ) {}

  ngOnInit(): void {
    this.billing
      .getRefundEligibility(this.data.payment.id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (eligibility) => (this.eligibility = eligibility),
        error: () => this.dialogRef.close(null),
      });
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.billing
      .requestRefund(this.data.payment.id, this.form.controls.reason.value.trim())
      .pipe(finalize(() => (this.saving = false)))
      .subscribe((request) => this.dialogRef.close(request));
  }
}

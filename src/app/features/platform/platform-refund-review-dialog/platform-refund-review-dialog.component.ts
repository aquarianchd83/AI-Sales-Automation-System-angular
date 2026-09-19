import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { Payment, RefundRequest, RefundStatus } from '../../../core/models/billing.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformRefundService } from '../../../core/services/platform-refund.service';

export type RefundReviewMode = 'approve' | 'reject' | 'direct';

export interface PlatformRefundReviewDialogData {
  mode: RefundReviewMode;
  /** For approve/reject: the request being decided. */
  request?: RefundRequest;
  /** For a direct refund: the payment being refunded and whose it is. */
  payment?: Payment;
  tenantId?: string;
}

/**
 * One dialog for the three things an operator does about a refund. Approving can pay less than the rules allow
 * (a partial refund) - the amount is entered in the tenant's own currency and converted back to the base-USD cents
 * the API takes. Rejecting always needs a reason, because the tenant reads it. A direct refund is the operator's
 * own initiative and also needs one, for the audit trail. Nothing here is automatic: every path is a click.
 */
@Component({
  selector: 'app-platform-refund-review-dialog',
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>

    <mat-dialog-content>
      <p class="muted" *ngIf="request">
        {{ request.tenantName }} · {{ request.paymentDescription }}
      </p>
      <p class="muted" *ngIf="!request && data.payment">{{ data.payment.planName }}</p>

      <div class="reason-box" *ngIf="request?.reason">
        <span class="muted">Their reason</span>
        <p>{{ request!.reason }}</p>
      </div>

      <div class="failure" *ngIf="request?.status === RefundStatus.Failed">
        <mat-icon>error</mat-icon>
        <span>The last payout attempt failed: {{ request!.failureReason }}. Approving again retries it.</span>
      </div>

      <form [formGroup]="form" novalidate>
        <mat-form-field class="full-width" *ngIf="data.mode === 'approve'">
          <mat-label>Amount to refund ({{ request!.currencyCode }})</mat-label>
          <span matTextPrefix>{{ request!.currencySymbol }}&nbsp;</span>
          <input matInput type="number" step="0.01" min="0.01" [max]="request!.eligibleLocalAmount" formControlName="amount" />
          <mat-hint>Up to {{ request!.currencySymbol }}{{ request!.eligibleLocalAmount | number: '1.2-2' }} - what the rules allow.</mat-hint>
          <mat-error>Enter an amount between 0.01 and {{ request!.eligibleLocalAmount | number: '1.2-2' }}.</mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>{{ data.mode === 'reject' ? 'Reason (shown to the tenant)' : data.mode === 'direct' ? 'Reason (kept in the audit log)' : 'Note (optional)' }}</mat-label>
          <textarea matInput rows="3" maxlength="1000" formControlName="note"></textarea>
          <mat-error>A reason is required.</mat-error>
        </mat-form-field>
      </form>

      <p class="muted note" *ngIf="data.mode !== 'reject'">
        The money is returned to the original payment method and the unused credits are removed. This can't be undone.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="null">Cancel</button>
      <button mat-flat-button [color]="data.mode === 'reject' ? 'warn' : 'primary'" type="button" [disabled]="saving" (click)="submit()">
        {{ confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .reason-box {
        margin-bottom: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        background: #f5f5f5;
        font-size: 13px;
      }
      .reason-box p {
        margin: 4px 0 0;
      }
      .failure {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        background: #fdecea;
        color: #b3261e;
        font-size: 13px;
      }
      .note {
        font-size: 12px;
      }
    `,
  ],
})
export class PlatformRefundReviewDialogComponent {
  readonly RefundStatus = RefundStatus;
  readonly request = this.data.request;

  readonly form = this.fb.group({
    amount: [this.data.request?.eligibleLocalAmount ?? 0, this.data.mode === 'approve' ? [Validators.required, Validators.min(0.01)] : []],
    note: ['', this.data.mode === 'approve' ? [] : [Validators.required, Validators.maxLength(1000)]],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly refunds: PlatformRefundService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformRefundReviewDialogComponent, RefundRequest | null>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformRefundReviewDialogData
  ) {}

  get title(): string {
    return this.data.mode === 'approve' ? 'Approve refund' : this.data.mode === 'reject' ? 'Decline refund' : 'Refund this payment';
  }

  get confirmLabel(): string {
    return this.data.mode === 'approve' ? 'Approve & refund' : this.data.mode === 'reject' ? 'Decline request' : 'Refund';
  }

  submit(): void {
    if (this.saving) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { amount, note } = this.form.getRawValue();
    const trimmed = note.trim();
    if (this.data.mode !== 'approve' && !trimmed) {
      this.form.controls.note.setErrors({ required: true });
      this.form.controls.note.markAsTouched();
      return;
    }

    let request$;
    if (this.data.mode === 'approve') {
      const eligible = this.request!;
      // Entered in the tenant's currency; the API takes base-USD cents, so scale by the share of the ceiling.
      const cents =
        amount >= eligible.eligibleLocalAmount
          ? eligible.eligibleAmountCents
          : Math.max(1, Math.round((eligible.eligibleAmountCents * amount) / eligible.eligibleLocalAmount));
      request$ = this.refunds.approve(eligible.id, trimmed, cents);
    } else if (this.data.mode === 'reject') {
      request$ = this.refunds.reject(this.request!.id, trimmed);
    } else {
      request$ = this.refunds.refundDirect(this.data.tenantId!, this.data.payment!.id, trimmed);
    }

    this.saving = true;
    request$.pipe(finalize(() => (this.saving = false))).subscribe((result) => {
      if (result.status === RefundStatus.Failed) {
        this.notify.error(`The payout failed: ${result.failureReason ?? 'the gateway refused it'}. Nothing was changed - you can retry.`);
      } else if (this.data.mode === 'reject') {
        this.notify.success('Request declined.');
      } else {
        this.notify.success('Refund issued.');
      }
      this.dialogRef.close(result);
    });
  }
}

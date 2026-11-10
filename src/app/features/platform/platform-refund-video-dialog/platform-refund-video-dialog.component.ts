import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { PlatformStoryVideoRequestDetail } from '../../../core/models/story-studio.model';
import { PlatformStoryVideoRequestService } from '../../../core/services/platform-story-video-request.service';

export interface PlatformRefundVideoDialogData {
  requestId: string;
  title: string;
  tenantName: string;
  /** The credits the tenant prepaid, when known: the amount that goes back. */
  prepaidCredits: number | null;
}

/**
 * The platform admin refunds a video request that cannot be made. The reason is required because the tenant reads it - in the Story studio next to the
 * story and in the in-app notice - and the prepaid credits go back to the tenant's balance. Closes with the updated request once the refund went through;
 * a failure keeps the dialog open (the reason is not lost) and the error shows as usual.
 */
@Component({
  selector: 'app-platform-refund-video-dialog',
  template: `
    <h2 mat-dialog-title>Refund this video</h2>

    <mat-dialog-content>
      <p class="muted" data-testid="refund-subject">{{ data.tenantName }} · {{ data.title }}</p>

      <form [formGroup]="form" novalidate>
        <mat-form-field class="full-width" appearance="outline">
          <mat-label>Reason (shown to the tenant)</mat-label>
          <textarea matInput rows="4" maxlength="500" formControlName="reason" data-testid="refund-reason" cdkFocusInitial></textarea>
          <mat-hint align="end">{{ form.controls.reason.value.length }} / 500</mat-hint>
          <mat-error>Say why the video could not be made: the tenant reads it.</mat-error>
        </mat-form-field>
      </form>

      <p class="muted note" data-testid="refund-note">
        <ng-container *ngIf="data.prepaidCredits !== null; else plain">{{ data.prepaidCredits | number: '1.0-2' }} prepaid credits go back to the tenant's balance.</ng-container>
        <ng-template #plain>The prepaid credits go back to the tenant's balance.</ng-template>
        The tenant sees your reason beside the story and in an in-app notice. This can't be undone.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="null" [disabled]="saving">Cancel</button>
      <button mat-flat-button color="warn" type="button" (click)="refund()" [disabled]="saving" data-testid="refund-confirm">
        {{ saving ? 'Refunding…' : data.prepaidCredits !== null ? 'Refund ' + (data.prepaidCredits | number: '1.0-2') + ' credits' : 'Refund the credits' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .muted {
        color: rgba(0, 0, 0, 0.6);
      }
      .note {
        font-size: 13px;
        margin: 4px 0 0;
      }
    `,
  ],
})
export class PlatformRefundVideoDialogComponent {
  readonly form = this.fb.group({ reason: ['', [Validators.required, Validators.maxLength(500)]] });
  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly requests: PlatformStoryVideoRequestService,
    private readonly ref: MatDialogRef<PlatformRefundVideoDialogComponent, PlatformStoryVideoRequestDetail | null>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformRefundVideoDialogData,
  ) {}

  refund(): void {
    const reason = this.form.controls.reason.value.trim();
    if (!reason) {
      this.form.controls.reason.setValue('');
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving) {
      return;
    }
    this.saving = true;
    this.requests
      .reject(this.data.requestId, reason)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe((detail) => this.ref.close(detail));
  }
}

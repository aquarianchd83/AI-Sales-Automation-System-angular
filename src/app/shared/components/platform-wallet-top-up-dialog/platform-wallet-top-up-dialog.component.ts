import { Component } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { WALLET_PROVIDERS, WalletProvider } from '../../../core/models/platform-wallet.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWalletService } from '../../../core/services/platform-wallet.service';

/** yyyy-MM-dd from the picker's local date - not toISOString(), which would shift the day for anyone east or west of UTC. */
export function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Adds money to the platform wallet: the date it was added, the AI provider it was for, and the amount in rupees. */
@Component({
  selector: 'app-platform-wallet-top-up-dialog',
  template: `
    <h2 mat-dialog-title>Add credit to wallet</h2>

    <mat-dialog-content>
      <form [formGroup]="form" novalidate class="top-up-form">
        <mat-form-field class="full-width">
          <mat-label>Date</mat-label>
          <input matInput [matDatepicker]="picker" [max]="today" formControlName="date" data-testid="top-up-date" />
          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          <mat-error>Pick the date the credit was added.</mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>AI provider</mat-label>
          <mat-select formControlName="provider" data-testid="top-up-provider">
            <mat-option *ngFor="let provider of providers" [value]="provider.value">{{ provider.label }}</mat-option>
          </mat-select>
          <mat-error>Choose the provider.</mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Amount</mat-label>
          <span matTextPrefix>₹&nbsp;</span>
          <input matInput type="number" min="0.01" step="0.01" formControlName="amount" data-testid="top-up-amount" />
          <mat-error>Enter an amount above zero.</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="saving" (click)="submit()" data-testid="top-up-submit">
        {{ saving ? 'Adding…' : 'Add credit' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .top-up-form {
        display: flex;
        flex-direction: column;
        min-width: min(360px, 80vw);
      }
    `,
  ],
})
export class PlatformWalletTopUpDialogComponent {
  readonly providers = WALLET_PROVIDERS;
  readonly today = new Date();

  readonly form = this.fb.group({
    date: [new Date() as Date | null, Validators.required],
    provider: [null as WalletProvider | null, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly wallet: PlatformWalletService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformWalletTopUpDialogComponent, boolean>
  ) {}

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const { date, provider, amount } = this.form.getRawValue();
    this.saving = true;
    this.wallet
      .addTopUp({ date: toDateOnly(date!), provider: provider!, amount: amount! })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe(() => {
        this.notify.success('Credit added to the wallet.');
        this.dialogRef.close(true);
      });
  }
}

import { Component, Inject } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { PlatformUserSearchService } from '../../../core/services/platform-user-search.service';

export interface ResetUserPasswordDialogData {
  userId: string;
  email: string;
  fullName: string;
}

/** Mirrors the API's password policy (Application.Common.PasswordPolicy), which checks it again. */
function passwordPolicy(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  const ok = value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[^a-zA-Z0-9]/.test(value);
  return ok ? null : { policy: true };
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('newPassword')?.value === group.get('confirm')?.value ? null : { mismatch: true };
}

/** Support reset of a tenant user's password: the operator types the new one, the API signs the user out everywhere and audits it. */
@Component({
  selector: 'app-platform-user-password-reset-dialog',
  template: `
    <h2 mat-dialog-title>Reset password</h2>
    <form [formGroup]="form" (ngSubmit)="reset()">
      <mat-dialog-content>
        <p>
          Set a new password for <strong>{{ data.fullName }}</strong> ({{ data.email }}). They are signed out everywhere and
          can sign in with the new password straight away. Tell them the password through a safe channel.
        </p>
        <mat-form-field appearance="outline" class="full">
          <mat-label>New password</mat-label>
          <input matInput formControlName="newPassword" [type]="show ? 'text' : 'password'" autocomplete="new-password" />
          <button mat-icon-button matSuffix type="button" (click)="show = !show" [attr.aria-label]="show ? 'Hide password' : 'Show password'">
            <mat-icon>{{ show ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-hint>At least 8 characters with upper and lower case, a digit and a symbol.</mat-hint>
          <mat-error *ngIf="form.controls.newPassword.hasError('policy')">
            Use at least 8 characters with upper and lower case letters, a digit and a symbol.
          </mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Confirm new password</mat-label>
          <input matInput formControlName="confirm" [type]="show ? 'text' : 'password'" autocomplete="new-password" />
          <mat-error *ngIf="form.hasError('mismatch')">The passwords don't match.</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" [disabled]="busy" (click)="dialogRef.close(false)">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="busy || form.invalid">Reset password</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: ['.full { width: 100%; margin-top: 8px; }'],
})
export class PlatformUserPasswordResetDialogComponent {
  readonly form = new FormGroup(
    {
      newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, passwordPolicy] }),
      confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: passwordsMatch }
  );
  show = false;
  busy = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ResetUserPasswordDialogData,
    readonly dialogRef: MatDialogRef<PlatformUserPasswordResetDialogComponent, boolean>,
    private readonly users: PlatformUserSearchService
  ) {}

  reset(): void {
    if (this.busy || this.form.invalid) {
      return;
    }
    this.busy = true;
    this.users
      .resetPassword(this.data.userId, this.form.controls.newPassword.value)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          /* ErrorInterceptor toasts it; keep the dialog open */
        },
      });
  }
}

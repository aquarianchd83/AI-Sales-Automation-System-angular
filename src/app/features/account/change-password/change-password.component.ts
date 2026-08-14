import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

/** Cross-field check: confirmation must match the new password. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword
    ? { passwordMismatch: true }
    : null;
}

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent {
  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      // Matches the ASP.NET Core Identity default minimum; the API is the authority
      // on the full policy and will return its own message if this passes but fails there.
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch }
  );

  submitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly notify: NotificationService,
    private readonly router: Router
  ) {}

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting = true;
    this.auth
      .changePassword({ currentPassword, newPassword })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.notify.success('Password changed.');
          this.form.reset();
          void this.router.navigate(['/dashboard']);
        },
        error: () => {
          /* ErrorInterceptor already surfaced it */
        },
      });
  }
}

import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PASSWORD_POLICY_HINT, PASSWORD_POLICY_PATTERN, RecoveryChannel } from '../../../core/models/recovery.model';
import { AccountRecoveryService } from '../../../core/services/account-recovery.service';
import { NotificationService } from '../../../core/services/notification.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/**
 * Choosing a new password. Reached from the emailed link (`?email=&token=`) or after asking for an SMS code (`?email=&channel=sms`,
 * where the person types the six-digit code). Either way a success ends every session the account had, so the next step is signing in.
 */
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['../recovery.scss'],
})
export class ResetPasswordComponent implements OnInit {
  readonly passwordHint = PASSWORD_POLICY_HINT;

  readonly form = this.fb.nonNullable.group(
    {
      code: [''],
      newPassword: ['', [Validators.required, Validators.pattern(PASSWORD_POLICY_PATTERN)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch }
  );

  email = '';
  token = '';
  channel: RecoveryChannel = 'email';
  hidePassword = true;
  submitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly recovery: AccountRecoveryService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    this.email = query.get('email') ?? '';
    this.token = query.get('token') ?? '';
    this.channel = query.get('channel') === 'sms' ? 'sms' : 'email';

    if (this.channel === 'sms') {
      this.form.controls.code.addValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
    }
  }

  /** An emailed link needs both halves; an SMS reset needs the address (the code is typed in). */
  get linkUsable(): boolean {
    return !!this.email && (this.channel === 'sms' || !!this.token);
  }

  submit(): void {
    if (this.form.invalid || this.submitting || !this.linkUsable) {
      this.form.markAllAsTouched();
      return;
    }

    const { code, newPassword } = this.form.getRawValue();
    this.submitting = true;
    this.recovery
      .resetPassword({
        email: this.email,
        token: this.channel === 'sms' ? code.trim() : this.token,
        newPassword,
        channel: this.channel,
      })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.notify.success('Your password has been changed. Sign in with the new one.');
          void this.router.navigateByUrl('/login');
        },
        error: () => {
          // ErrorInterceptor toasts why (an expired link, a wrong code, a password the rules reject).
        },
      });
  }
}

import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { RecoveryChannel } from '../../../core/models/recovery.model';
import { AccountRecoveryService } from '../../../core/services/account-recovery.service';

/**
 * Asks for a password reset by emailed link or by a code texted to a verified phone. The answer is the same whether or not the address
 * has an account (the API answers 204 either way), so this page can say only "if there is one" - it must not become a way to find
 * out who is registered.
 */
@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../recovery.scss'],
})
export class ForgotPasswordComponent {
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    channel: this.fb.nonNullable.control<RecoveryChannel>('email'),
  });

  submitting = false;
  /** The channel the request went out on, once it has; null while the form is still being filled in. */
  sentVia: RecoveryChannel | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly recovery: AccountRecoveryService,
    private readonly router: Router
  ) {}

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, channel } = this.form.getRawValue();
    this.submitting = true;
    this.recovery
      .forgotPassword({ email: email.trim(), channel })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => (this.sentVia = channel),
        error: () => {
          // ErrorInterceptor toasts it (e.g. a rate-limit refusal).
        },
      });
  }

  /** From the "we sent a code" screen straight to entering it. */
  enterCode(): void {
    void this.router.navigate(['/recover/reset-password'], {
      queryParams: { email: this.form.controls.email.value.trim(), channel: 'sms' },
    });
  }

  tryAgain(): void {
    this.sentVia = null;
  }
}

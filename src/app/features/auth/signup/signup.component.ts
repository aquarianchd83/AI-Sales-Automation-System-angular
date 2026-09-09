import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * Self-serve signup (POST /auth/signup) — the only account-creation path for a brand-new tenant.
 * Creates a Tenant on a 14-day trial plus its first Admin user, then logs that user in exactly
 * like LoginComponent would, so submitting this form lands straight on the dashboard.
 */
@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent {
  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.maxLength(200)]],
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  hidePassword = true;
  submitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly notify: NotificationService
  ) {}

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    // slug is deliberately omitted — the backend derives and de-duplicates one from
    // companyName automatically; nothing in this UI collects a custom slug yet.
    this.auth
      .signUp(this.form.getRawValue())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (user) => {
          this.notify.success(`Welcome, ${user.fullName}! Your workspace is ready.`);
          void this.router.navigateByUrl('/dashboard');
        },
        // A 409 (email already exists) is surfaced by ErrorInterceptor's generic toast, which is
        // already a clear enough message for that case — no extra handling needed here.
      });
  }
}

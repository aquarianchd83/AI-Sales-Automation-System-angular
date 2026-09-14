import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';
import { PLATFORM_ADMIN_ROLES } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  hidePassword = true;
  submitting = false;

  /** Null means "no explicit destination" — resolved against the logged-in user's own roles once
   * login succeeds (see submit()), rather than defaulting to '/dashboard' here: a PlatformSuperAdmin
   * has no tenant dashboard to land on (roleGuard would immediately bounce them back out with a
   * "you do not have access" toast), so the right default depends on who actually just signed in. */
  private returnUrl: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  }

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.auth
      .login(this.form.getRawValue())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (user) => {
          this.notify.success(`Welcome back, ${user.fullName || user.email}.`);
          const isPlatformSuperAdmin = user.roles.some((role) => PLATFORM_ADMIN_ROLES.includes(role));
          void this.router.navigateByUrl(this.returnUrl ?? (isPlatformSuperAdmin ? '/platform' : '/dashboard'));
        },
        // Failures are surfaced by ErrorInterceptor; 401 is the one it skips,
        // so give invalid credentials their own message here.
        error: (error: { status?: number }) => {
          if (error?.status === 401) {
            this.notify.error('Incorrect email or password.');
          }
        },
      });
  }
}

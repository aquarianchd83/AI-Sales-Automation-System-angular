import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { RegionOption, TimeZoneOption } from '../../../core/models/billing.model';
import { AuthService } from '../../../core/services/auth.service';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeZoneService } from '../../../core/services/timezone.service';

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
export class SignupComponent implements OnInit {
  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.maxLength(200)]],
    // The one business detail signup asks for — the rest go on the Business Profile page later.
    productName: ['', Validators.maxLength(200)],
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    country: [''],
    state: [''],
    timezone: [''],
  });

  hidePassword = true;
  submitting = false;
  regions: RegionOption[] = [];
  timezones: TimeZoneOption[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly billing: BillingService,
    private readonly timeZoneService: TimeZoneService,
    private readonly router: Router,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    // Best-effort only — an empty list just means the country/timezone selects render with no
    // options, signup still works fine and falls back to USD pricing / IST (see
    // AuthService.SignUpAsync).
    this.billing.getRegions().subscribe({
      next: (regions) => (this.regions = regions),
      error: () => (this.regions = []),
    });
    this.timeZoneService.getTimezones().subscribe({
      next: (timezones) => (this.timezones = timezones),
      error: () => (this.timezones = []),
    });
  }

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const { country, state, timezone, productName, ...raw } = this.form.getRawValue();
    // slug is deliberately omitted — the backend derives and de-duplicates one from
    // companyName automatically; nothing in this UI collects a custom slug yet.
    this.auth
      .signUp({
        ...raw,
        productName: productName.trim() || null,
        countryCode: country || null,
        stateCode: state || null,
        timezone: timezone || null,
      })
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

import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { UserProfile } from '../../../core/models/account.model';
import { TimeZoneOption } from '../../../core/models/billing.model';
import { PLATFORM_ADMIN_ROLES } from '../../../core/models/platform.model';
import { AccountService } from '../../../core/services/account.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeZoneService } from '../../../core/services/timezone.service';

/** Any phone shape the API accepts (it matches AccountValidators). */
const PHONE_PATTERN = /^\+?[0-9 ()-]{5,31}$/;
/** The product owner's number is where WhatsApp alerts go, and WhatsApp needs the country code, so a leading + is required. */
const ALERT_PHONE_PATTERN = /^\+[0-9 ()-]{6,30}$/;

/**
 * The signed-in user's own profile. For the platform's product owner the phone number is more than contact detail: it is the number the
 * platform's urgent alerts (a ticket raised for something only they can fix) are sent to on WhatsApp.
 */
@Component({
  selector: 'app-account-profile',
  templateUrl: './account-profile.component.html',
})
export class AccountProfileComponent implements OnInit {
  readonly isProductOwner = this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    phoneNumber: ['', [Validators.pattern(this.isProductOwner ? ALERT_PHONE_PATTERN : PHONE_PATTERN)]],
    timezone: ['', [Validators.required]],
  });

  timezones: TimeZoneOption[] = [];
  profile: UserProfile | null = null;
  loading = true;
  saving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly account: AccountService,
    private readonly auth: AuthService,
    private readonly timeZones: TimeZoneService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.timeZones.getTimezones().subscribe({ next: (zones) => (this.timezones = zones) });
    this.account
      .getProfile()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((profile) => this.fill(profile));
  }

  get emailChanged(): boolean {
    return !!this.profile && this.form.controls.email.value.trim().toLowerCase() !== this.profile.email.toLowerCase();
  }

  save(): void {
    if (this.form.invalid || this.saving || !this.profile) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving = true;
    this.account
      .updateProfile({
        fullName: value.fullName.trim(),
        email: value.email.trim(),
        phoneNumber: value.phoneNumber.trim() || null,
        timezone: value.timezone,
        // Not edited here, but the update replaces every field, so the current one is sent back untouched.
        countryCode: this.profile.countryCode,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (profile) => {
          this.fill(profile);
          this.auth.patchCurrentUser({ fullName: profile.fullName });
          this.notify.success('Profile saved.');
        },
        error: () => {
          /* ErrorInterceptor already surfaced it */
        },
      });
  }

  private fill(profile: UserProfile): void {
    this.profile = profile;
    this.form.reset({
      fullName: profile.fullName,
      email: profile.email,
      phoneNumber: profile.phoneNumber ?? '',
      timezone: profile.timezone,
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { finalize, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

import { UpdateUserProfileRequest, UserProfile } from '../../../core/models/account.model';
import { RegionOption, TimeZoneOption } from '../../../core/models/billing.model';
import { PHONE_PATTERN } from '../../../core/models/tenant-profile.model';
import { AccountRecoveryService } from '../../../core/services/account-recovery.service';
import { AccountService } from '../../../core/services/account.service';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * The signed-in user's own account — name, sign-in email, phone, display timezone and country, plus the
 * read-only facts (role, created, last login). Reached from the account menu by anyone, and from the
 * Platform Admin Console's nav, which is the only profile screen a PlatformSuperAdmin has: they belong to no
 * tenant, so the tenant Users screens can't see or edit them at all.
 *
 * Two saves need more than a toast:
 * - Changing the timezone repaints every timestamp in the app, which already-rendered views won't do on
 *   their own (ZonedDatePipe is pure, deliberately), so the app is reloaded after the save.
 * - Changing the email changes what you sign in with, and the token in hand keeps the old address in its
 *   claims until the next sign-in, so it is confirmed first.
 */
@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    phoneNumber: ['', [Validators.maxLength(32), Validators.pattern(PHONE_PATTERN)]],
    timezone: ['', Validators.required],
    countryCode: [''],
  });

  /** The six digits texted to the phone number on the profile. */
  readonly phoneCode = this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^\d{6}$/)]);

  loading = true;
  loadFailed = false;
  saving = false;
  sendingCode = false;
  codeSent = false;
  verifyingCode = false;

  profile: UserProfile | null = null;
  timezones: TimeZoneOption[] = [];
  regions: RegionOption[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly account: AccountService,
    private readonly timeZoneService: TimeZoneService,
    private readonly billing: BillingService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog,
    private readonly recovery: AccountRecoveryService
  ) {}

  ngOnInit(): void {
    this.timeZoneService.getTimezones().subscribe({
      next: (timezones) => (this.timezones = timezones),
      error: () => (this.timezones = []),
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.account.getProfile().subscribe({
      next: (profile) => {
        this.apply(profile);
        this.loadRegions(profile.countryCode);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  /** The countries the operator has switched on, plus the user's own if it has since been switched off. */
  private loadRegions(current: string | null): void {
    this.billing.getRegions(current).subscribe({
      next: (regions) => (this.regions = regions),
      error: () => (this.regions = []),
    });
  }

  /** True while the phone box shows something other than the saved number - verification is of the saved one, so it waits for a save. */
  get phoneEdited(): boolean {
    return !!this.profile && this.form.controls.phoneNumber.value.trim() !== (this.profile.phoneNumber ?? '');
  }

  /** Verifying only makes sense for a saved number that is not verified yet. */
  get canVerifyPhone(): boolean {
    return !!this.profile?.phoneNumber && !this.profile.phoneNumberConfirmed && !this.phoneEdited;
  }

  get phoneVerified(): boolean {
    return !!this.profile?.phoneNumber && !!this.profile.phoneNumberConfirmed && !this.phoneEdited;
  }

  /** Texts a code to the saved number. Only a verified number can later receive a password-reset code. */
  sendPhoneCode(): void {
    if (this.sendingCode || !this.canVerifyPhone) {
      return;
    }
    this.sendingCode = true;
    this.recovery
      .sendPhoneCode()
      .pipe(finalize(() => (this.sendingCode = false)))
      .subscribe({
        next: () => {
          this.codeSent = true;
          this.phoneCode.reset('');
          this.notify.success(`We texted a code to ${this.profile?.phoneNumber}.`);
        },
        error: () => {
          // ErrorInterceptor toasts why (no country code, SMS not set up, asked too soon).
        },
      });
  }

  verifyPhoneCode(): void {
    if (this.verifyingCode || this.phoneCode.invalid) {
      this.phoneCode.markAsTouched();
      return;
    }
    this.verifyingCode = true;
    this.recovery
      .verifyPhone(this.phoneCode.value.trim())
      .pipe(
        switchMap(() => this.account.getProfile()),
        finalize(() => (this.verifyingCode = false))
      )
      .subscribe({
        next: (profile) => {
          this.codeSent = false;
          this.apply(profile);
          this.notify.success('Phone number verified.');
        },
        error: () => {
          // ErrorInterceptor toasts why (a wrong or expired code).
        },
      });
  }

  get emailChanged(): boolean {
    return !!this.profile && this.form.controls.email.value.trim().toLowerCase() !== this.profile.email.toLowerCase();
  }

  get timezoneChanged(): boolean {
    return !!this.profile && this.form.controls.timezone.value !== this.profile.timezone;
  }

  get roleLabel(): string {
    if (!this.profile?.roles.length) {
      return 'No role assigned';
    }
    return this.profile.roles.join(', ');
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '?';
  }

  discard(): void {
    if (this.profile) {
      this.apply(this.profile);
    }
  }

  save(): void {
    if (this.saving || !this.profile) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const confirmed$ = this.emailChanged
      ? this.dialog
          .open(ConfirmDialogComponent, {
            width: '460px',
            data: {
              title: 'Change your sign-in email?',
              message:
                `You'll sign in as ${this.form.controls.email.value.trim()} from now on. ` +
                `Until you sign in again, audit entries still record your previous address.`,
              confirmLabel: 'Change email',
            },
          })
          .afterClosed()
      : of(true);

    confirmed$
      .pipe(
        switchMap((confirmed) => {
          if (!confirmed) {
            return of(null);
          }
          this.saving = true;
          const v = this.form.getRawValue();
          const request: UpdateUserProfileRequest = {
            fullName: v.fullName.trim(),
            email: v.email.trim(),
            phoneNumber: v.phoneNumber.trim() || null,
            timezone: v.timezone,
            countryCode: v.countryCode || null,
          };
          return this.account.updateProfile(request).pipe(finalize(() => (this.saving = false)));
        })
      )
      .subscribe({
        next: (profile) => {
          if (!profile) {
            return;
          }
          const repaint = this.timezoneChanged;
          this.apply(profile);
          this.notify.success('Profile saved.');
          if (repaint) {
            // Timestamps already on screen were formatted in the old zone — see this component's doc comment.
            this.reloadApp();
          }
        },
      });
  }

  /** Its own method so a spec can stub it — calling window.location.reload() under Karma reloads the test
   * runner itself. */
  reloadApp(): void {
    window.location.reload();
  }

  private apply(profile: UserProfile): void {
    if (this.profile && this.profile.phoneNumber !== profile.phoneNumber) {
      this.codeSent = false;
    }
    this.profile = profile;
    this.form.reset({
      fullName: profile.fullName,
      email: profile.email,
      phoneNumber: profile.phoneNumber ?? '',
      timezone: profile.timezone,
      countryCode: profile.countryCode ?? '',
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Observable, concat } from 'rxjs';
import { finalize, last } from 'rxjs/operators';

import { RegionOption, TimeZoneOption } from '../../core/models/billing.model';
import {
  INDUSTRY_SUGGESTIONS,
  PHONE_PATTERN,
  TENANT_PROFILE_LIMITS,
  TenantProfile,
  UpdateTenantBusinessProfileRequest,
  WEBSITE_PATTERN,
  blankToNull,
} from '../../core/models/tenant-profile.model';
import { BillingService } from '../../core/services/billing.service';
import { NotificationService } from '../../core/services/notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { TimeZoneService } from '../../core/services/timezone.service';

const L = TENANT_PROFILE_LIMITS;

/**
 * The tenant's own Business Profile — company and product names, industry, description, contact
 * details, plus the workspace timezone and country (moved here from Settings).
 *
 * One Save covers the whole page: the business fields go in a single PUT, and timezone/country are
 * sent to their own endpoints only when they changed, one after another so the last response is the
 * freshest full profile.
 */
@Component({
  selector: 'app-business-profile',
  templateUrl: './business-profile.component.html',
  styleUrls: ['./business-profile.component.scss'],
})
export class BusinessProfileComponent implements OnInit {
  readonly limits = L;

  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.maxLength(L.companyName)]],
    productName: ['', Validators.maxLength(L.productName)],
    // Industry, description, support email and phone, and country are what onboarding's first step needs.
    industry: ['', [Validators.required, Validators.maxLength(L.industry)]],
    // Optional: Healthcare is general, "Eye clinic" is what the business actually is.
    industrySubcategory: ['', Validators.maxLength(L.industrySubcategory)],
    businessDescription: ['', [Validators.required, Validators.maxLength(L.businessDescription)]],
    websiteUrl: ['', [Validators.maxLength(L.websiteUrl), Validators.pattern(WEBSITE_PATTERN)]],
    supportEmail: ['', [Validators.required, Validators.maxLength(L.supportEmail), Validators.email]],
    supportPhone: ['', [Validators.required, Validators.maxLength(L.supportPhone), Validators.pattern(PHONE_PATTERN)]],
    workingHours: ['', Validators.maxLength(L.workingHours)],
    timezone: ['', Validators.required],
    countryCode: ['', Validators.required],
    stateCode: [''],
  });

  loading = true;
  loadFailed = false;
  saving = false;

  timezones: TimeZoneOption[] = [];
  regions: RegionOption[] = [];

  private saved: TenantProfile | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly profileService: TenantProfileService,
    private readonly timeZoneService: TimeZoneService,
    private readonly billing: BillingService,
    private readonly notify: NotificationService
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
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.apply(profile);
        this.billing.getRegions(profile.countryCode).subscribe({
          next: (regions) => (this.regions = regions),
          error: () => (this.regions = []),
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  get hasChanges(): boolean {
    return this.form.dirty;
  }

  get filteredIndustries(): string[] {
    const typed = this.form.controls.industry.value.trim().toLowerCase();
    return typed
      ? INDUSTRY_SUGGESTIONS.filter((option) => option.toLowerCase().includes(typed))
      : INDUSTRY_SUGGESTIONS;
  }

  /** How many of the optional-but-useful details are filled in, for the summary card. */
  get completeness(): { done: number; total: number; percent: number } {
    const v = this.form.getRawValue();
    const checks = [
      v.companyName,
      v.productName,
      v.industry,
      v.businessDescription,
      v.websiteUrl,
      v.supportEmail,
      v.supportPhone,
    ];
    const done = checks.filter((value) => value.trim().length > 0).length;
    return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '?';
  }

  discard(): void {
    if (this.saved) {
      this.apply(this.saved);
    }
  }

  save(): void {
    if (this.saving || !this.saved) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: UpdateTenantBusinessProfileRequest = {
      companyName: v.companyName.trim(),
      productName: blankToNull(v.productName),
      industry: blankToNull(v.industry),
      industrySubcategory: blankToNull(v.industrySubcategory),
      businessDescription: blankToNull(v.businessDescription),
      websiteUrl: blankToNull(v.websiteUrl),
      supportEmail: blankToNull(v.supportEmail),
      supportPhone: blankToNull(v.supportPhone),
      // No longer asked on this page - keep whatever is already stored.
      domainKeywords: this.saved.domainKeywords,
      workingHours: blankToNull(v.workingHours),
      // Who to reach is gathered on the Lead Discovery profile, not here - keep whatever is already stored.
      targetAudience: this.saved.targetAudience ?? null,
      targetLocation: this.saved.targetLocation ?? null,
      targetCustomerType: this.saved.targetCustomerType ?? null,
    };

    const steps: Observable<TenantProfile>[] = [this.profileService.updateBusinessProfile(request)];
    if (v.timezone && v.timezone !== this.saved.timezone) {
      steps.push(this.profileService.updateTimezone(v.timezone));
    }
    if (v.countryCode && (v.countryCode !== (this.saved.countryCode ?? '') || v.stateCode !== (this.saved.stateCode ?? ''))) {
      steps.push(this.profileService.updateCountry(v.countryCode, v.stateCode));
    }

    this.saving = true;
    concat(...steps)
      .pipe(
        last(),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: (profile) => {
          this.apply(profile);
          this.notify.success('Business profile saved.');
        },
      });
  }

  private apply(profile: TenantProfile): void {
    this.saved = profile;
    this.form.reset({
      companyName: profile.companyName,
      productName: profile.productName ?? '',
      industry: profile.industry ?? '',
      industrySubcategory: profile.industrySubcategory ?? '',
      businessDescription: profile.businessDescription ?? '',
      websiteUrl: profile.websiteUrl ?? '',
      supportEmail: profile.supportEmail ?? '',
      supportPhone: profile.supportPhone ?? '',
      workingHours: profile.workingHours ?? '',
      timezone: profile.timezone,
      countryCode: profile.countryCode ?? '',
      stateCode: profile.stateCode ?? '',
    });
  }
}

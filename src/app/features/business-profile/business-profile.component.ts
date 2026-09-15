import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
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
  addDomainKeywords,
  blankToNull,
} from '../../core/models/tenant-profile.model';
import { BillingService } from '../../core/services/billing.service';
import { NotificationService } from '../../core/services/notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { TimeZoneService } from '../../core/services/timezone.service';

const L = TENANT_PROFILE_LIMITS;

/**
 * The tenant's own Business Profile — company and product names, industry, description, contact
 * details and domain keywords, plus the workspace timezone and country (moved here from Settings).
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
  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.maxLength(L.companyName)]],
    productName: ['', Validators.maxLength(L.productName)],
    industry: ['', Validators.maxLength(L.industry)],
    businessDescription: ['', Validators.maxLength(L.businessDescription)],
    websiteUrl: ['', [Validators.maxLength(L.websiteUrl), Validators.pattern(WEBSITE_PATTERN)]],
    supportEmail: ['', [Validators.maxLength(L.supportEmail), Validators.email]],
    supportPhone: ['', [Validators.maxLength(L.supportPhone), Validators.pattern(PHONE_PATTERN)]],
    timezone: ['', Validators.required],
    countryCode: [''],
  });

  readonly keywordInput = new FormControl('', { nonNullable: true });

  keywords: string[] = [];
  keywordError: string | null = null;

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
    this.billing.getRegions().subscribe({
      next: (regions) => (this.regions = regions),
      error: () => (this.regions = []),
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.apply(profile);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  get hasChanges(): boolean {
    return this.form.dirty || !sameKeywords(this.keywords, this.saved?.domainKeywords ?? []);
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
      this.keywords.length ? 'yes' : '',
    ];
    const done = checks.filter((value) => value.trim().length > 0).length;
    return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '?';
  }

  addKeyword(event: MatChipInputEvent): void {
    this.addKeywords(event.value);
    if (!this.keywordError) {
      event.chipInput.clear();
      this.keywordInput.setValue('');
    }
  }

  /** Accepts one keyword or a pasted comma-separated list — see addDomainKeywords. */
  addKeywords(raw: string): void {
    const result = addDomainKeywords(this.keywords, raw);
    this.keywords = result.keywords;
    this.keywordError = result.error;
  }

  removeKeyword(keyword: string): void {
    this.keywords = this.keywords.filter((k) => k !== keyword);
    this.keywordError = null;
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
      businessDescription: blankToNull(v.businessDescription),
      websiteUrl: blankToNull(v.websiteUrl),
      supportEmail: blankToNull(v.supportEmail),
      supportPhone: blankToNull(v.supportPhone),
      domainKeywords: this.keywords,
    };

    const steps: Observable<TenantProfile>[] = [this.profileService.updateBusinessProfile(request)];
    if (v.timezone && v.timezone !== this.saved.timezone) {
      steps.push(this.profileService.updateTimezone(v.timezone));
    }
    if (v.countryCode && v.countryCode !== (this.saved.countryCode ?? '')) {
      steps.push(this.profileService.updateCountry(v.countryCode));
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
      businessDescription: profile.businessDescription ?? '',
      websiteUrl: profile.websiteUrl ?? '',
      supportEmail: profile.supportEmail ?? '',
      supportPhone: profile.supportPhone ?? '',
      timezone: profile.timezone,
      countryCode: profile.countryCode ?? '',
    });
    this.keywords = [...profile.domainKeywords];
    this.keywordError = null;
    this.keywordInput.setValue('');
  }
}

function sameKeywords(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((keyword, i) => keyword === b[i]);
}

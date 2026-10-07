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
  KeywordSuggestions,
  RefinedDescription,
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

  readonly keywordInput = new FormControl('', { nonNullable: true });

  keywords: string[] = [];
  keywordError: string | null = null;

  /** What "AI suggest" last returned, for the industry it was asked about; empty once added or dismissed. */
  suggestions: string[] = [];
  suggestionSource: KeywordSuggestions['source'] | null = null;
  suggestedFor = '';
  suggesting = false;

  /** What "AI suggest" last proposed for the description. Nothing replaces the tenant's text until they use it. */
  descriptionProposal: RefinedDescription | null = null;
  refiningDescription = false;
  /** Set when the last request came back with nothing to offer. */
  noSuggestions = false;

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

  /** "AI suggest" on the description: a refined version of what the tenant wrote, shown beside it to accept or dismiss. */
  refineDescription(): void {
    const description = this.form.controls.businessDescription.value.trim();
    if (!description || this.refiningDescription) {
      return;
    }
    this.refiningDescription = true;
    this.profileService
      .refineDescription({
        description,
        industry: blankToNull(this.form.controls.industry.value),
        industrySubcategory: blankToNull(this.form.controls.industrySubcategory.value),
      })
      .pipe(finalize(() => (this.refiningDescription = false)))
      .subscribe({
        next: (result) => (this.descriptionProposal = result),
        error: () => undefined, // the error interceptor shows why
      });
  }

  useDescriptionProposal(): void {
    if (!this.descriptionProposal) {
      return;
    }
    this.form.controls.businessDescription.setValue(this.descriptionProposal.description);
    this.form.controls.businessDescription.markAsDirty();
    this.descriptionProposal = null;
  }

  dismissDescriptionProposal(): void {
    this.descriptionProposal = null;
  }

  /** "AI suggest": keywords for the selected industry. Nothing is added until the tenant picks. */
  suggestKeywords(): void {
    const industry = this.form.controls.industry.value.trim();
    if (!industry || this.suggesting) {
      return;
    }
    this.suggesting = true;
    this.noSuggestions = false;
    this.profileService
      .suggestKeywords({
        industry,
        industrySubcategory: blankToNull(this.form.controls.industrySubcategory.value),
        businessDescription: blankToNull(this.form.controls.businessDescription.value),
        existing: this.keywords,
      })
      .pipe(finalize(() => (this.suggesting = false)))
      .subscribe({
        next: (result) => {
          this.suggestions = result.keywords;
          this.suggestionSource = result.source;
          this.suggestedFor = industry;
          this.noSuggestions = result.keywords.length === 0;
        },
        error: () => undefined, // the error interceptor shows why
      });
  }

  /** Adds one suggestion the way a typed keyword is added, and takes it off the list. */
  addSuggestion(keyword: string): void {
    this.addKeywords(keyword);
    if (!this.keywordError) {
      this.suggestions = this.suggestions.filter((s) => s !== keyword);
    }
  }

  addAllSuggestions(): void {
    this.addKeywords(this.suggestions.join(','));
    this.suggestions = this.suggestions.filter((s) => !this.keywords.some((k) => k.toLowerCase() === s.toLowerCase()));
  }

  dismissSuggestions(): void {
    this.suggestions = [];
    this.noSuggestions = false;
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
      industrySubcategory: blankToNull(v.industrySubcategory),
      businessDescription: blankToNull(v.businessDescription),
      websiteUrl: blankToNull(v.websiteUrl),
      supportEmail: blankToNull(v.supportEmail),
      supportPhone: blankToNull(v.supportPhone),
      domainKeywords: this.keywords,
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
    this.keywords = [...profile.domainKeywords];
    this.keywordError = null;
    this.keywordInput.setValue('');
  }
}

function sameKeywords(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((keyword, i) => keyword === b[i]);
}

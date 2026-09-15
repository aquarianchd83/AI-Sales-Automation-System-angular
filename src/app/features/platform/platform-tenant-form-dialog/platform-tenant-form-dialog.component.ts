import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
import { MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { RegionOption, TimeZoneOption } from '../../../core/models/billing.model';
import { PlatformTenantDetail } from '../../../core/models/platform.model';
import {
  INDUSTRY_SUGGESTIONS,
  PHONE_PATTERN,
  TENANT_PROFILE_LIMITS,
  WEBSITE_PATTERN,
  addDomainKeywords,
  blankToNull,
} from '../../../core/models/tenant-profile.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { TimeZoneService } from '../../../core/services/timezone.service';

const L = TENANT_PROFILE_LIMITS;

/** The optional controls that live in the collapsible Business details section. */
const DETAIL_CONTROLS = [
  'countryCode',
  'timezone',
  'productName',
  'industry',
  'businessDescription',
  'websiteUrl',
  'supportEmail',
  'supportPhone',
] as const;

/** Operator-initiated tenant creation — the Platform Admin Console's counterpart to self-serve
 * signup. Mirrors UserFormDialogComponent's shape (a temporary password set by the creator, shown/
 * hidden with the same toggle), not the public signup form, since the PlatformSuperAdmin is setting
 * up the account for someone else rather than signing themselves up.
 *
 * The collapsed Business details section optionally pre-fills what the tenant would otherwise enter
 * on its own Business Profile page (plus country and timezone), using the same limits and keyword
 * rules. */
@Component({
  selector: 'app-platform-tenant-form-dialog',
  templateUrl: './platform-tenant-form-dialog.component.html',
  styles: [
    `
      .note {
        margin: 8px 0 0;
        font-size: 12px;
      }
      .details {
        display: block;
        margin-top: 8px;
      }
      .details mat-panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .details mat-panel-title mat-icon {
        color: #00796b;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0 12px;
      }
      .span-2 {
        grid-column: 1 / -1;
      }
      .keyword-error {
        margin: 4px 0 0;
        font-size: 12px;
        color: #b3261e;
      }
      @media (max-width: 600px) {
        .detail-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class PlatformTenantFormDialogComponent implements OnInit {
  readonly limits = L;
  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.maxLength(L.companyName)]],
    slug: ['', [Validators.pattern('^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')]],
    adminFullName: ['', [Validators.required, Validators.maxLength(200)]],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminPassword: ['', [Validators.required, Validators.minLength(8)]],
    countryCode: [''],
    timezone: [''],
    productName: ['', Validators.maxLength(L.productName)],
    industry: ['', Validators.maxLength(L.industry)],
    businessDescription: ['', Validators.maxLength(L.businessDescription)],
    websiteUrl: ['', [Validators.maxLength(L.websiteUrl), Validators.pattern(WEBSITE_PATTERN)]],
    supportEmail: ['', [Validators.maxLength(L.supportEmail), Validators.email]],
    supportPhone: ['', [Validators.maxLength(L.supportPhone), Validators.pattern(PHONE_PATTERN)]],
  });

  readonly keywordInput = new FormControl('', { nonNullable: true });

  keywords: string[] = [];
  keywordError: string | null = null;
  detailsExpanded = false;

  hidePassword = true;
  saving = false;

  timezones: TimeZoneOption[] = [];
  regions: RegionOption[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly tenants: PlatformTenantService,
    private readonly timeZoneService: TimeZoneService,
    private readonly billing: BillingService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformTenantFormDialogComponent, PlatformTenantDetail | false>
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
  }

  get filteredIndustries(): string[] {
    const typed = this.form.controls.industry.value.trim().toLowerCase();
    return typed
      ? INDUSTRY_SUGGESTIONS.filter((option) => option.toLowerCase().includes(typed))
      : INDUSTRY_SUGGESTIONS;
  }

  /** Shown in the collapsed panel header so the operator can see details were entered. */
  get detailsFilled(): number {
    const v = this.form.getRawValue();
    return DETAIL_CONTROLS.filter((name) => v[name].trim()).length + (this.keywords.length ? 1 : 0);
  }

  addKeyword(event: MatChipInputEvent): void {
    const result = addDomainKeywords(this.keywords, event.value);
    this.keywords = result.keywords;
    this.keywordError = result.error;
    if (!result.error) {
      event.chipInput.clear();
      this.keywordInput.setValue('');
    }
  }

  removeKeyword(keyword: string): void {
    this.keywords = this.keywords.filter((k) => k !== keyword);
    this.keywordError = null;
  }

  save(): void {
    if (this.saving) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // An error hidden inside the collapsed section would otherwise look like a dead button.
      if (DETAIL_CONTROLS.some((name) => this.form.controls[name].invalid)) {
        this.detailsExpanded = true;
      }
      return;
    }

    const raw = this.form.getRawValue();
    this.saving = true;
    this.tenants
      .create({
        companyName: raw.companyName.trim(),
        slug: raw.slug.trim() || null,
        adminFullName: raw.adminFullName.trim(),
        adminEmail: raw.adminEmail.trim(),
        adminPassword: raw.adminPassword,
        countryCode: raw.countryCode || null,
        timezone: raw.timezone || null,
        productName: blankToNull(raw.productName),
        industry: blankToNull(raw.industry),
        businessDescription: blankToNull(raw.businessDescription),
        websiteUrl: blankToNull(raw.websiteUrl),
        supportEmail: blankToNull(raw.supportEmail),
        supportPhone: blankToNull(raw.supportPhone),
        domainKeywords: this.keywords,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (tenant) => {
          this.notify.success(`${tenant.name} created.`);
          this.dialogRef.close(tenant);
        },
        error: () => {
          /* ErrorInterceptor toasts it; keep the dialog open */
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

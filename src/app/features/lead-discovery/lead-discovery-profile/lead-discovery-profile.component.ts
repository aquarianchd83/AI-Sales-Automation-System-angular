import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
import { finalize } from 'rxjs/operators';

import {
  LEAD_DISCOVERY_CHECKBOX_FIELDS,
  LEAD_DISCOVERY_LIMITS,
  LeadDiscoveryProfile,
  SaveLeadDiscoveryProfileRequest,
  addListEntries,
} from '../../../core/models/lead-discovery.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';

const L = LEAD_DISCOVERY_LIMITS;

type ListKey = 'keywords' | 'locations' | 'additionalCriteria';

const LIST_OPTIONS: Record<ListKey, { maxLength: number; maxCount: number; noun: string; separator?: string }> = {
  keywords: { maxLength: L.keyword, maxCount: L.maxKeywords, noun: 'keyword', separator: ',' },
  // No separator: "Andheri West, Mumbai" is one location.
  locations: { maxLength: L.location, maxCount: L.maxLocations, noun: 'location' },
  additionalCriteria: { maxLength: L.criterion, maxCount: L.maxAdditionalCriteria, noun: 'criterion' },
};

/**
 * The tenant's lead discovery profile — what the lead-discovery job searches for, how many new leads a
 * run may add, and the rules a business must pass to be saved. Tenant Admin only.
 *
 * "Phone" and "Email" in requiredFields mean exactly what phoneRequired/emailRequired mean (see
 * LeadQualification on the backend), so they are shown only as those two switches: loading folds them
 * into the switches and saving leaves them out of requiredFields.
 */
@Component({
  selector: 'app-lead-discovery-profile',
  templateUrl: './lead-discovery-profile.component.html',
  styleUrls: ['./lead-discovery-profile.component.scss'],
})
export class LeadDiscoveryProfileComponent implements OnInit {
  readonly limits = L;
  readonly keywordSeparators = [ENTER, COMMA] as const;
  readonly locationSeparators = [ENTER] as const;
  readonly checkboxFields = LEAD_DISCOVERY_CHECKBOX_FIELDS;

  readonly form = this.fb.nonNullable.group({
    isEnabled: [false],
    targetBusinessType: ['', [Validators.required, Validators.maxLength(L.targetBusinessType)]],
    batchSize: [25, [Validators.required, Validators.min(1), Validators.max(L.maxBatchSize)]],
    minimumLeadScore: [60, [Validators.required, Validators.min(0), Validators.max(100)]],
    phoneRequired: [true],
    emailRequired: [false],
    independentBusiness: [false],
    fields: this.fb.nonNullable.group({
      ContactPerson: [false],
      Address: [false],
      City: [false],
      State: [false],
      Website: [false],
    }),
  });

  readonly keywordInput = new FormControl('', { nonNullable: true });
  readonly locationInput = new FormControl('', { nonNullable: true });
  readonly criterionInput = new FormControl('', { nonNullable: true });

  lists: Record<ListKey, string[]> = { keywords: [], locations: [], additionalCriteria: [] };
  listErrors: Record<ListKey, string | null> = { keywords: null, locations: null, additionalCriteria: null };

  loading = true;
  loadFailed = false;
  saving = false;
  /** Set by a save attempt, so "add at least one" messages don't show before the user tries. */
  submitted = false;

  saved: LeadDiscoveryProfile | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly leadDiscovery: LeadDiscoveryService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.leadDiscovery.getProfile().subscribe({
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

  /** The most the batch size field accepts: the plan's cap when there is one, never above the API's own. */
  get batchLimit(): number {
    const plan = this.saved?.planMaxBatchSize;
    return plan == null ? L.maxBatchSize : Math.min(plan, L.maxBatchSize);
  }

  /** A plan with a per-run cap of 0 doesn't include lead discovery at all. */
  get planExcludesDiscovery(): boolean {
    return this.saved?.planMaxBatchSize === 0;
  }

  get hasChanges(): boolean {
    if (this.form.dirty) {
      return true;
    }
    const saved = this.saved;
    return (
      !!saved &&
      (!sameList(this.lists.keywords, saved.keywords) ||
        !sameList(this.lists.locations, saved.locations) ||
        !sameList(this.lists.additionalCriteria, saved.additionalCriteria))
    );
  }

  get keywordsMissing(): boolean {
    return this.submitted && !this.lists.keywords.length;
  }

  get locationsMissing(): boolean {
    return this.submitted && !this.lists.locations.length;
  }

  /** One sentence describing what a run will do, for the side card. */
  get summary(): string {
    const v = this.form.getRawValue();
    const type = v.targetBusinessType.trim() || 'businesses';
    const where = this.lists.locations.length
      ? ` in ${this.lists.locations.slice(0, 2).join(' and ')}${this.lists.locations.length > 2 ? ` and ${this.lists.locations.length - 2} more` : ''}`
      : '';
    return `Finds up to ${v.batchSize || 0} new ${type.toLowerCase()} leads per run${where}, keeping those scoring ${v.minimumLeadScore ?? 0} or more.`;
  }

  addKeyword(event: MatChipInputEvent): void {
    if (this.add('keywords', event.value)) {
      event.chipInput.clear();
      this.keywordInput.setValue('');
    }
  }

  addLocation(event: MatChipInputEvent): void {
    if (this.add('locations', event.value)) {
      event.chipInput.clear();
      this.locationInput.setValue('');
    }
  }

  addCriterion(): void {
    if (this.add('additionalCriteria', this.criterionInput.value)) {
      this.criterionInput.setValue('');
    }
  }

  remove(key: ListKey, value: string): void {
    this.lists = { ...this.lists, [key]: this.lists[key].filter((v) => v !== value) };
    this.listErrors = { ...this.listErrors, [key]: null };
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
    this.submitted = true;
    if (this.form.invalid || !this.lists.keywords.length || !this.lists.locations.length) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: SaveLeadDiscoveryProfileRequest = {
      isEnabled: v.isEnabled,
      targetBusinessType: v.targetBusinessType.trim(),
      keywords: this.lists.keywords,
      locations: this.lists.locations,
      batchSize: v.batchSize,
      requiredFields: this.checkboxFields.filter((f) => v.fields[f.key]).map((f) => f.key),
      phoneRequired: v.phoneRequired,
      emailRequired: v.emailRequired,
      independentBusiness: v.independentBusiness,
      minimumLeadScore: v.minimumLeadScore,
      additionalCriteria: this.lists.additionalCriteria,
    };

    this.saving = true;
    this.leadDiscovery
      .saveProfile(request)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (profile) => {
          this.apply(profile);
          this.notify.success(profile.isEnabled ? 'Lead discovery profile saved. Discovery is on.' : 'Lead discovery profile saved.');
        },
        // ErrorInterceptor toasts validation and plan-limit errors; the edits stay on screen.
      });
  }

  /** Adds typed text to one of the lists; true when nothing was rejected, so the input can be cleared. */
  private add(key: ListKey, raw: string): boolean {
    const result = addListEntries(this.lists[key], raw, LIST_OPTIONS[key]);
    this.lists = { ...this.lists, [key]: result.values };
    this.listErrors = { ...this.listErrors, [key]: result.error };
    return !result.error;
  }

  private apply(profile: LeadDiscoveryProfile): void {
    this.saved = profile;
    this.submitted = false;

    const required = (key: string) => profile.requiredFields.some((f) => f.toLowerCase() === key.toLowerCase());
    this.form.reset({
      isEnabled: profile.isEnabled,
      targetBusinessType: profile.targetBusinessType ?? '',
      batchSize: profile.batchSize,
      minimumLeadScore: profile.minimumLeadScore,
      phoneRequired: profile.phoneRequired || required('Phone'),
      emailRequired: profile.emailRequired || required('Email'),
      independentBusiness: profile.independentBusiness,
      fields: {
        ContactPerson: required('ContactPerson'),
        Address: required('Address'),
        City: required('City'),
        State: required('State'),
        Website: required('Website'),
      },
    });

    const batchSize = this.form.controls.batchSize;
    batchSize.setValidators([Validators.required, Validators.min(1), Validators.max(this.batchLimit)]);
    batchSize.updateValueAndValidity();
    if (batchSize.invalid) {
      // A saved batch size above a since-lowered plan cap — show why Save won't go through.
      batchSize.markAsTouched();
    }

    this.lists = {
      keywords: [...(profile.keywords ?? [])],
      locations: [...(profile.locations ?? [])],
      additionalCriteria: [...(profile.additionalCriteria ?? [])],
    };
    this.listErrors = { keywords: null, locations: null, additionalCriteria: null };
    this.keywordInput.setValue('');
    this.locationInput.setValue('');
    this.criterionInput.setValue('');
  }
}

function sameList(a: string[], b: string[] | null | undefined): boolean {
  const other = b ?? [];
  return a.length === other.length && a.every((value, i) => value === other[i]);
}

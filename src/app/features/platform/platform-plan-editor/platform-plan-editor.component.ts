import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { RegionOption } from '../../../core/models/billing.model';
import { CreatePlanRequest, PlatformPlan, UpdatePlanRequest } from '../../../core/models/platform.model';
import { PLATFORM_FEATURES, PLATFORM_FEATURE_LABELS, PlatformFeature } from '../../../core/models/wallet.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { countryPriceRows, newCountryPriceRow, toCountryPriceInputs } from '../country-price-editor/country-price-editor.component';

/**
 * The page for creating or editing a plan. A plan is its credits (granted once when a tenant goes onto it, and every month after - unspent credits carry
 * over, and the plan never expires), the features its tenants can use (any other is hidden in the app and refused by the API), its limits and its price.
 * Changing a plan's credits or features changes what its tenants get from now on; it never takes back what they already received.
 */
@Component({
  selector: 'app-platform-plan-editor',
  templateUrl: './platform-plan-editor.component.html',
  styleUrls: ['./platform-plan-editor.component.scss'],
})
export class PlatformPlanEditorComponent implements OnInit {
  readonly allFeatures = PLATFORM_FEATURES;
  readonly featureLabels = PLATFORM_FEATURE_LABELS;

  planId: string | null = null;
  plan: PlatformPlan | null = null;

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/)]],
    name: ['', Validators.required],
    maxUsers: [0, [Validators.required, Validators.min(0)]],
    maxCampaigns: [0, [Validators.required, Validators.min(0)]],
    maxKnowledgeBaseArticles: [0, [Validators.required, Validators.min(0)]],
    // 25 is Plan.DefaultLeadDiscoveryBatchSize on the backend.
    maxLeadDiscoveryBatchSize: [25, [Validators.required, Validators.min(0)]],
    starterCredits: [0, [Validators.required, Validators.min(0)]],
    monthlyCredits: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });

  /** The features the plan includes. */
  readonly features = new Set<PlatformFeature>();

  readonly countryPrices = countryPriceRows([]);
  regions: RegionOption[] = [];

  loading = true;
  loadFailed = false;
  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly billing: PlatformBillingService,
    private readonly regionSource: BillingService,
    private readonly notify: NotificationService
  ) {}

  get isEditMode(): boolean {
    return this.planId !== null;
  }

  ngOnInit(): void {
    this.planId = this.route.snapshot.paramMap.get('id');
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;

    forkJoin({
      regions: this.regionSource.getRegions(),
      plans: this.planId ? this.billing.getPlans() : of<PlatformPlan[]>([]),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ regions, plans }) => {
          if (this.planId) {
            const plan = plans.find((p) => p.id === this.planId);
            if (!plan) {
              this.loadFailed = true;
              return;
            }
            this.plan = plan;
            this.patchPlan(plan);
          }

          // The countries switched on, plus any that already carries a price - a country switched off later keeps its
          // price and stays editable here.
          const known = new Set(regions.map((r) => r.countryCode));
          const kept = (this.plan?.countryPrices ?? [])
            .filter((p) => !known.has(p.countryCode))
            .map((p) => ({ countryCode: p.countryCode, countryName: p.countryName + ' (off)', currencyCode: p.currencyCode, currencySymbol: p.currencySymbol }));
          this.regions = [...regions, ...kept];

          // A new plan starts with India's row, since the platform is based there: the price is entered in rupees.
          if (!this.planId && this.countryPrices.length === 0) {
            this.countryPrices.push(newCountryPriceRow('IN', 0));
          }

          this.form.markAsPristine();
        },
        error: () => (this.loadFailed = true),
      });
  }

  hasFeature(feature: PlatformFeature): boolean {
    return this.features.has(feature);
  }

  toggleFeature(feature: PlatformFeature, on: boolean): void {
    if (on) {
      this.features.add(feature);
    } else {
      this.features.delete(feature);
    }
    this.form.markAsDirty();
  }

  save(): void {
    if (this.form.invalid || this.countryPrices.invalid || this.saving) {
      this.form.markAllAsTouched();
      this.countryPrices.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    // The price is the country prices below - there is no separate base price. The server derives the one legacy USD figure.
    const priceMonthlyCents = 0;
    const features = PLATFORM_FEATURES.filter((f) => this.features.has(f));
    const countryPrices = toCountryPriceInputs(this.countryPrices);

    this.saving = true;
    const request$ = this.planId
      ? this.billing.updatePlan(this.planId, {
          name: raw.name,
          maxUsers: raw.maxUsers,
          maxMessagesPerMonth: this.plan?.maxMessagesPerMonth ?? 0,
          maxCampaigns: raw.maxCampaigns,
          maxKnowledgeBaseArticles: raw.maxKnowledgeBaseArticles,
          maxLeadDiscoveryBatchSize: raw.maxLeadDiscoveryBatchSize,
          priceMonthlyCents,
          isActive: raw.isActive,
          starterCredits: raw.starterCredits,
          monthlyCredits: raw.monthlyCredits,
          features,
          countryPrices,
        } as UpdatePlanRequest)
      : this.billing.createPlan({
          code: raw.code,
          name: raw.name,
          maxUsers: raw.maxUsers,
          // There is no monthly message cap any more - sending is paid for with credits.
          maxMessagesPerMonth: 0,
          maxCampaigns: raw.maxCampaigns,
          maxKnowledgeBaseArticles: raw.maxKnowledgeBaseArticles,
          maxLeadDiscoveryBatchSize: raw.maxLeadDiscoveryBatchSize,
          priceMonthlyCents,
          starterCredits: raw.starterCredits,
          monthlyCredits: raw.monthlyCredits,
          features,
          countryPrices,
        } as CreatePlanRequest);

    request$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEditMode ? 'Plan updated.' : 'Plan created.');
        this.form.markAsPristine();
        this.router.navigate(['/platform/billing']);
      },
      error: () => {
        /* ErrorInterceptor toasts it; stay on the page */
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/platform/billing']);
  }

  private patchPlan(plan: PlatformPlan): void {
    this.form.patchValue({
      code: plan.code,
      name: plan.name,
      maxUsers: plan.maxUsers,
      maxCampaigns: plan.maxCampaigns,
      maxKnowledgeBaseArticles: plan.maxKnowledgeBaseArticles,
      maxLeadDiscoveryBatchSize: plan.maxLeadDiscoveryBatchSize,
      starterCredits: plan.starterCredits,
      monthlyCredits: plan.monthlyCredits,
      isActive: plan.isActive,
    });
    // Code is immutable once a plan exists.
    this.form.controls.code.disable();

    this.features.clear();
    plan.features.forEach((f) => this.features.add(f));

    this.countryPrices.clear();
    for (const p of plan.countryPrices) {
      this.countryPrices.push(countryPriceRows([p]).at(0));
    }
  }
}

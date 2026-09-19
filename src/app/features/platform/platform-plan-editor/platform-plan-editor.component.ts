import { Component, OnDestroy, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, merge, of } from 'rxjs';
import { catchError, debounceTime, finalize, switchMap, takeUntil, tap } from 'rxjs/operators';

import { QuotaType, RegionOption, formatCharge } from '../../../core/models/billing.model';
import {
  CreatePlanRequest,
  PlanCostReport,
  PlanCostReportRequest,
  PlanQuotaInput,
  PlatformPlan,
  UpdatePlanRequest,
} from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { countryPriceRows, newCountryPriceRow, toCountryPriceInputs } from '../country-price-editor/country-price-editor.component';

/**
 * The page for creating or editing a plan (it replaces the old dialog). Beside the plan's fields it shows a live
 * consolidated report - what the quotas cost to serve, country by country, and the margin at the price entered - built
 * by the server from the Configuration page's charges, so the operator never works the WhatsApp, AI and lead discovery
 * costs out by hand. The prices and the typical-usage figures behind it all come from the Configuration page - nothing is
 * entered twice. The report recalculates as the plan changes; nothing is saved until "Create plan" / "Save".
 */
@Component({
  selector: 'app-platform-plan-editor',
  templateUrl: './platform-plan-editor.component.html',
  styleUrls: ['./platform-plan-editor.component.scss'],
})
export class PlatformPlanEditorComponent implements OnInit, OnDestroy {
  readonly formatCharge = formatCharge;

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
    quotaWhatsApp: [0, [Validators.required, Validators.min(0)]],
    quotaAi: [0, [Validators.required, Validators.min(0)]],
    quotaLeads: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });

  readonly countryPrices = countryPriceRows([]);
  regions: RegionOption[] = [];

  report: PlanCostReport | null = null;
  reportLoading = false;
  reportFailed = false;

  loading = true;
  loadFailed = false;
  saving = false;

  private readonly refresh$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

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

    // The report follows the plan as it is edited; a short pause keeps it from recalculating on every keystroke.
    merge(this.form.valueChanges, this.countryPrices.valueChanges, this.refresh$)
      .pipe(
        debounceTime(350),
        tap(() => {
          this.reportLoading = true;
          this.reportFailed = false;
        }),
        switchMap(() =>
          this.billing.buildPlanCostReport(this.reportRequest()).pipe(
            catchError(() => {
              this.reportFailed = true;
              return of(null);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((report) => {
        this.reportLoading = false;
        if (report) {
          this.report = report;
        }
      });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
          this.refresh$.next();
        },
        error: () => (this.loadFailed = true),
      });
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
    const includedQuotas = this.quotas();
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
          includedQuotas,
          countryPrices,
        } as UpdatePlanRequest)
      : this.billing.createPlan({
          code: raw.code,
          name: raw.name,
          maxUsers: raw.maxUsers,
          // There is no monthly message cap any more - sending is limited by the WhatsApp quota above.
          maxMessagesPerMonth: 0,
          maxCampaigns: raw.maxCampaigns,
          maxKnowledgeBaseArticles: raw.maxKnowledgeBaseArticles,
          maxLeadDiscoveryBatchSize: raw.maxLeadDiscoveryBatchSize,
          priceMonthlyCents,
          includedQuotas,
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

  /** The country where the plan earns the least - the number that decides whether it is safe to sell. */
  get worstMargin(): { countryName: string; marginPercent: number } | null {
    const rows = (this.report?.countries ?? []).filter((c) => c.isSold && c.marginPercent !== null);
    if (!rows.length) {
      return null;
    }
    const worst = rows.reduce((a, b) => ((a.marginPercent as number) <= (b.marginPercent as number) ? a : b));
    return { countryName: worst.countryName, marginPercent: worst.marginPercent as number };
  }

  /** A USD unit cost in rupees, at the rate the report was built with. */
  toInr(usd: number): number {
    return usd * (this.report?.inrPerUsd ?? 0);
  }

  private quotas(): PlanQuotaInput[] {
    const raw = this.form.getRawValue();
    return [
      { quotaType: QuotaType.WhatsAppMessages, units: raw.quotaWhatsApp },
      { quotaType: QuotaType.AiConversations, units: raw.quotaAi },
      { quotaType: QuotaType.LeadCandidates, units: raw.quotaLeads },
    ];
  }

  /** Rows still being filled in (no country yet, or no price) are left out - the report only prices complete ones. */
  private reportRequest(): PlanCostReportRequest {
    const raw = this.form.getRawValue();
    return {
      includedQuotas: this.quotas().map((q) => ({ ...q, units: Number(q.units) || 0 })),
      countryPrices: toCountryPriceInputs(this.countryPrices).filter((p) => p.countryCode && p.amount > 0),
    };
  }

  private patchPlan(plan: PlatformPlan): void {
    const units = (type: QuotaType) => plan.includedQuotas.find((q) => q.quotaType === type)?.units ?? 0;
    this.form.patchValue({
      code: plan.code,
      name: plan.name,
      maxUsers: plan.maxUsers,
      maxCampaigns: plan.maxCampaigns,
      maxKnowledgeBaseArticles: plan.maxKnowledgeBaseArticles,
      maxLeadDiscoveryBatchSize: plan.maxLeadDiscoveryBatchSize,
      quotaWhatsApp: units(QuotaType.WhatsAppMessages),
      quotaAi: units(QuotaType.AiConversations),
      quotaLeads: units(QuotaType.LeadCandidates),
      isActive: plan.isActive,
    });
    // Code is immutable once a plan exists.
    this.form.controls.code.disable();

    this.countryPrices.clear();
    for (const p of plan.countryPrices) {
      this.countryPrices.push(countryPriceRows([p]).at(0));
    }
  }
}

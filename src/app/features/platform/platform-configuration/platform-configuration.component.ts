import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import {
  AiModelRates,
  CountryConfig,
  LeadDiscoveryModelRates,
  TaxCountryConfig,
  PlatformConfiguration,
  WhatsAppCountryRates,
} from '../../../core/models/platform.model';
import { IndianState } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformConfigurationService } from '../../../core/services/platform-configuration.service';

const nonNegative = [Validators.required, Validators.min(0)];

/**
 * The Platform Admin Console's Configuration page: the billing rules (refund policy, alerts, trial quota, WhatsApp
 * quota weights) and what each metered thing is charged at (WhatsApp messages by category, lead discovery, AI
 * conversations). One form, one Save - the document is replaced as a whole, so what is on screen is what is stored.
 * A refund's usage limit is shown as a percentage but travels as a 0-1 fraction.
 */
@Component({
  selector: 'app-platform-configuration',
  templateUrl: './platform-configuration.component.html',
  styleUrls: ['./platform-configuration.component.scss'],
})
export class PlatformConfigurationComponent implements OnInit {
  readonly form = this.fb.group({
    refunds: this.fb.group({
      creditWindowDays: [30, [Validators.required, Validators.min(1), Validators.max(3650)]],
      subscriptionWindowDays: [7, [Validators.required, Validators.min(1), Validators.max(3650)]],
      subscriptionMaxUsagePercent: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
      subscriptionPeriodDays: [30, [Validators.required, Validators.min(1), Validators.max(366)]],
      requestExpiryDays: [14, [Validators.required, Validators.min(1), Validators.max(365)]],
    }),
    alerts: this.fb.group({
      whatsAppTemplateName: ['', [Validators.required, Validators.pattern(/^[a-z0-9_]{1,100}$/)]],
      whatsAppTemplateLanguage: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})?$/)]],
    }),
    trial: this.fb.group({
      whatsAppMessages: [0, nonNegative],
      aiConversations: [0, nonNegative],
      leadCandidates: [0, nonNegative],
    }),
    whatsAppDefault: this.categoryRates(),
    whatsAppCountries: this.fb.array<FormGroup>([]),
    webSearchPerThousand: [0, nonNegative],
    leadDefault: this.leadRates('Default'),
    leadModels: this.fb.array<FormGroup>([]),
    leadDefaultModel: [''],
    aiModels: this.fb.array<FormGroup>([]),
    aiDefaultModel: [''],
    // Tax is always added on top of a price; the state decides CGST + SGST versus IGST for India.
    supplierStateCode: ['MH', [Validators.required]],
    taxCountries: this.fb.array<FormGroup>([]),
    // Typical usage the plan cost report prices a plan against: how the WhatsApp quota splits, and how big one AI conversation
    // and one lead candidate are. Set here once so no plan page asks for it again.
    costing: this.fb.group({
      marketingSharePercent: [60, [Validators.required, Validators.min(0)]],
      utilitySharePercent: [30, [Validators.required, Validators.min(0)]],
      authenticationSharePercent: [10, [Validators.required, Validators.min(0)]],
      promptTokensPerConversation: [0, [Validators.required, Validators.min(0)]],
      completionTokensPerConversation: [0, [Validators.required, Validators.min(0)]],
      inputTokensPerCandidate: [0, [Validators.required, Validators.min(0)]],
      outputTokensPerCandidate: [0, [Validators.required, Validators.min(0)]],
      webSearchesPerCandidate: [0, [Validators.required, Validators.min(0)]],
    }),
    // Rupees per US dollar - the one exchange rate set by hand.
    inrPerUsd: [83, [Validators.required, Validators.min(1), Validators.max(1000)]],
    // One control per country, in catalog order; at least one must stay enabled.
    countries: this.fb.array<FormGroup>([], [PlatformConfigurationComponent.atLeastOneEnabled]),
  });

  /** Which sections are open. All start closed, so the page reads as a short list. */
  open: Record<string, boolean> = {
    countries: false, tax: false, fx: false, costing: false, refunds: false,
    alerts: false, trial: false, whatsapp: false, lead: false, ai: false,
  };

  states: IndianState[] = [];
  /** Where the platform averages the "fill from" button would use come from, once fetched. */
  averagesSource: { ai: string; lead: string } | null = null;
  fillingAverages = false;
  loading = true;
  saving = false;
  loadFailed = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly configuration: PlatformConfigurationService,
    private readonly notify: NotificationService,
    private readonly billing: BillingService,
    private readonly platformBilling: PlatformBillingService
  ) {}

  /** The rate table's rows - the countries that are switched on. */
  get countries(): FormArray<FormGroup> {
    return this.form.controls.whatsAppCountries;
  }

  /** How much of the pooled WhatsApp quota one message of each category uses, as a share of a marketing message. Not a setting: it
   * is the ratio of the prices in the "all other countries" row, so it moves when those prices do. */
  get quotaUsePerMessage(): { marketing: number; utility: number; authentication: number } {
    const d = this.form.controls.whatsAppDefault.getRawValue() as { marketing: number; utility: number; authentication: number };
    const marketing = Number(d.marketing);
    if (!(marketing > 0)) {
      return { marketing: 1, utility: 1, authentication: 1 };
    }
    const share = (price: number) => Math.round((Number(price) / marketing) * 10000) / 10000;
    return { marketing: 1, utility: share(d.utility), authentication: share(d.authentication) };
  }

  get countryChoices(): FormArray<FormGroup> {
    return this.form.controls.countries;
  }

  private static atLeastOneEnabled(control: AbstractControl): ValidationErrors | null {
    const groups = (control as FormArray).controls as FormGroup[];
    return groups.length === 0 || groups.some((g) => g.controls['isEnabled'].value) ? null : { noneEnabled: true };
  }

  get leadModels(): FormArray<FormGroup> {
    return this.form.controls.leadModels;
  }

  get aiModels(): FormArray<FormGroup> {
    return this.form.controls.aiModels;
  }

  get taxCountries(): FormArray<FormGroup> {
    return this.form.controls.taxCountries;
  }

  ngOnInit(): void {
    this.billing.getStates('IN').subscribe({ next: (states) => (this.states = states), error: () => (this.states = []) });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.configuration
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (config) => this.patch(config),
        error: () => (this.loadFailed = true),
      });
  }

  /** Fills the typical-usage fields from what the platform has actually recorded (AI conversations and discovery runs of the
   * last 90 days), falling back to built-in estimates where there is no history. Nothing is saved until Save. */
  fillFromAverages(): void {
    if (this.fillingAverages) {
      return;
    }
    this.fillingAverages = true;
    this.platformBilling
      .getPlanCostDefaults()
      .pipe(finalize(() => (this.fillingAverages = false)))
      .subscribe({
        next: (defaults) => {
          this.form.controls.costing.patchValue(defaults.assumptions);
          this.averagesSource = { ai: defaults.aiSource, lead: defaults.leadSource };
          this.form.markAsDirty();
        },
      });
  }

  /** True when something in that section is invalid, so a closed section can still flag it. */
  sectionInvalid(key: string): boolean {
    const f = this.form.controls;
    const controls: Record<string, { invalid: boolean }[]> = {
      countries: [f.countries],
      tax: [f.supplierStateCode, f.taxCountries],
      fx: [f.inrPerUsd],
      costing: [f.costing],
      refunds: [f.refunds],
      alerts: [f.alerts],
      trial: [f.trial],
      whatsapp: [f.whatsAppDefault, f.whatsAppCountries],
      lead: [f.webSearchPerThousand, f.leadDefault, f.leadModels],
      ai: [f.aiModels],
    };
    return (controls[key] ?? []).some((c) => c.invalid);
  }

  setAll(expanded: boolean): void {
    for (const key of Object.keys(this.open)) {
      this.open[key] = expanded;
    }
  }

  addLeadModel(): void {
    this.leadModels.push(this.leadRates(''));
    this.form.markAsDirty();
  }

  addAiModel(): void {
    this.aiModels.push(
      this.fb.group({
        model: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._\-]+:[A-Za-z0-9._\-:]+$/)]],
        promptPer1K: [0, nonNegative],
        completionPer1K: [0, nonNegative],
        isNew: [true],
      })
    );
    this.form.markAsDirty();
  }

  /** Marks a model as the one the platform runs (its rates price any model with no row of its own); clicking the
   * default again clears the choice. Only a model with a valid name can be chosen. */
  toggleDefault(kind: 'lead' | 'ai', group: FormGroup): void {
    const control = kind === 'lead' ? this.form.controls.leadDefaultModel : this.form.controls.aiDefaultModel;
    const name = (group.controls['model'].value as string).trim();
    control.setValue(control.value === name ? '' : name);
    this.form.markAsDirty();
  }

  isDefault(kind: 'lead' | 'ai', group: FormGroup): boolean {
    const chosen = kind === 'lead' ? this.form.controls.leadDefaultModel.value : this.form.controls.aiDefaultModel.value;
    const name = (group.controls['model'].value as string).trim();
    return !!name && chosen === name;
  }

  removeNew(array: FormArray<FormGroup>, index: number): void {
    const removed = (array.at(index).controls['model'].value as string).trim();
    if (this.form.controls.leadDefaultModel.value === removed) {
      this.form.controls.leadDefaultModel.setValue('');
    }
    if (this.form.controls.aiDefaultModel.value === removed) {
      this.form.controls.aiDefaultModel.setValue('');
    }
    array.removeAt(index);
    this.form.markAsDirty();
  }

  isNew(group: FormGroup): boolean {
    return group.controls['isNew']?.value === true;
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      // Open whatever is wrong, so the error is not hiding in a closed section.
      for (const key of Object.keys(this.open)) {
        if (this.sectionInvalid(key)) {
          this.open[key] = true;
        }
      }
      return;
    }

    this.saving = true;
    this.configuration
      .save(this.toConfiguration())
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (saved) => {
          this.patch(saved);
          this.notify.success('Configuration saved. It applies from the next request.');
        },
        error: () => {
          /* ErrorInterceptor toasts it; keep the form as edited */
        },
      });
  }

  private categoryRates(): FormGroup {
    return this.fb.group({ marketing: [0, nonNegative], utility: [0, nonNegative], authentication: [0, nonNegative] });
  }

  private leadRates(model: string): FormGroup {
    return this.fb.group({
      model: [model, model === 'Default' ? [] : [Validators.required, Validators.pattern(/^[A-Za-z0-9._\-]{1,100}$/)]],
      inputPerMillion: [0, nonNegative],
      outputPerMillion: [0, nonNegative],
      cacheReadPerMillion: [0, nonNegative],
      cacheWritePerMillion: [0, nonNegative],
      isNew: [model === ''],
    });
  }

  private patch(config: PlatformConfiguration): void {
    const { refunds, alerts, trial, charges } = config;

    this.form.patchValue({
      refunds: {
        creditWindowDays: refunds.creditWindowDays,
        subscriptionWindowDays: refunds.subscriptionWindowDays,
        subscriptionMaxUsagePercent: Math.round(refunds.subscriptionMaxUsageFraction * 10000) / 100,
        subscriptionPeriodDays: refunds.subscriptionPeriodDays,
        requestExpiryDays: refunds.requestExpiryDays,
      },
      alerts,
      trial,
      whatsAppDefault: charges.whatsApp.default,
      webSearchPerThousand: charges.leadDiscovery.webSearchPerThousand,
      leadDefault: charges.leadDiscovery.default,
      leadDefaultModel: charges.leadDiscovery.defaultModel ?? '',
      aiDefaultModel: charges.ai.defaultModel ?? '',
    });

    this.countries.clear();
    for (const c of charges.whatsApp.countries) {
      this.countries.push(
        this.fb.group({
          countryCode: [c.countryCode],
          countryName: [c.countryName],
          marketing: [c.marketing, nonNegative],
          utility: [c.utility, nonNegative],
          authentication: [c.authentication, nonNegative],
        })
      );
    }

    this.countryChoices.clear();
    for (const c of config.countries ?? []) {
      this.countryChoices.push(
        this.fb.group({
          countryCode: [c.countryCode],
          countryName: [c.countryName],
          currencyCode: [c.currencyCode],
          currencySymbol: [c.currencySymbol],
          isEnabled: [c.isEnabled],
        })
      );
    }

    if (config.tax) {
      this.form.controls.supplierStateCode.setValue(config.tax.supplierStateCode);
      this.taxCountries.clear();
      for (const t of config.tax.countries) {
        this.taxCountries.push(
          this.fb.group({
            countryCode: [t.countryCode],
            countryName: [t.countryName],
            taxName: [t.taxName, [Validators.required, Validators.maxLength(20)]],
            ratePercent: [t.ratePercent, [Validators.required, Validators.min(0), Validators.max(100)]],
            splitByState: [t.splitByState],
          })
        );
      }
    }
    if (config.costAssumptions) {
      this.form.controls.costing.patchValue(config.costAssumptions);
    }
    if (config.fx) {
      this.form.controls.inrPerUsd.setValue(config.fx.inrPerUsd);
    }

    this.leadModels.clear();
    for (const m of charges.leadDiscovery.models) {
      const group = this.leadRates(m.model);
      group.patchValue({ ...m, isNew: false });
      this.leadModels.push(group);
    }

    this.aiModels.clear();
    for (const m of charges.ai.models) {
      this.aiModels.push(
        this.fb.group({
          model: [m.model],
          promptPer1K: [m.promptPer1K, nonNegative],
          completionPer1K: [m.completionPer1K, nonNegative],
          isNew: [false],
        })
      );
    }

    this.form.markAsPristine();
  }

  private toConfiguration(): PlatformConfiguration {
    const v = this.form.getRawValue();
    const refunds = v.refunds;

    return {
      tax: {
        supplierStateCode: v.supplierStateCode,
        countries: (v.taxCountries as TaxCountryConfig[]).map((t) => ({
          countryCode: t.countryCode,
          countryName: t.countryName,
          taxName: String(t.taxName).trim(),
          ratePercent: Number(t.ratePercent),
          splitByState: !!t.splitByState,
        })),
      },
      fx: { inrPerUsd: Number(v.inrPerUsd) },
      costAssumptions: {
        marketingSharePercent: Number(v.costing.marketingSharePercent),
        utilitySharePercent: Number(v.costing.utilitySharePercent),
        authenticationSharePercent: Number(v.costing.authenticationSharePercent),
        promptTokensPerConversation: Math.round(Number(v.costing.promptTokensPerConversation)),
        completionTokensPerConversation: Math.round(Number(v.costing.completionTokensPerConversation)),
        inputTokensPerCandidate: Math.round(Number(v.costing.inputTokensPerCandidate)),
        outputTokensPerCandidate: Math.round(Number(v.costing.outputTokensPerCandidate)),
        webSearchesPerCandidate: Number(v.costing.webSearchesPerCandidate),
      },
      countries: (v.countries as CountryConfig[]).map((c) => ({
        countryCode: c.countryCode,
        countryName: c.countryName,
        currencyCode: c.currencyCode,
        currencySymbol: c.currencySymbol,
        isEnabled: c.isEnabled,
      })),
      refunds: {
        creditWindowDays: refunds.creditWindowDays,
        subscriptionWindowDays: refunds.subscriptionWindowDays,
        subscriptionMaxUsageFraction: Math.round(refunds.subscriptionMaxUsagePercent * 100) / 10000,
        subscriptionPeriodDays: refunds.subscriptionPeriodDays,
        requestExpiryDays: refunds.requestExpiryDays,
      },
      alerts: { ...v.alerts, whatsAppTemplateName: v.alerts.whatsAppTemplateName.trim(), whatsAppTemplateLanguage: v.alerts.whatsAppTemplateLanguage.trim() },
      trial: v.trial,
      charges: {
        whatsApp: {
          default: v.whatsAppDefault as PlatformConfiguration['charges']['whatsApp']['default'],
          countries: (v.whatsAppCountries as WhatsAppCountryRates[]).map((c) => ({
            countryCode: c.countryCode,
            countryName: c.countryName,
            marketing: c.marketing,
            utility: c.utility,
            authentication: c.authentication,
          })),
        },
        leadDiscovery: {
          webSearchPerThousand: v.webSearchPerThousand,
          default: this.leadRow({ ...(v.leadDefault as LeadDiscoveryModelRates), model: 'Default' }),
          models: (v.leadModels as LeadDiscoveryModelRates[]).map((m) => this.leadRow(m)),
          defaultModel: v.leadDefaultModel.trim() || null,
        },
        ai: {
          models: (v.aiModels as AiModelRates[]).map((m) => ({
            model: m.model.trim(),
            promptPer1K: m.promptPer1K,
            completionPer1K: m.completionPer1K,
          })),
          defaultModel: v.aiDefaultModel.trim() || null,
        },
      },
    };
  }

  private leadRow(m: LeadDiscoveryModelRates): LeadDiscoveryModelRates {
    return {
      model: m.model.trim(),
      inputPerMillion: m.inputPerMillion,
      outputPerMillion: m.outputPerMillion,
      cacheReadPerMillion: m.cacheReadPerMillion,
      cacheWritePerMillion: m.cacheWritePerMillion,
    };
  }
}

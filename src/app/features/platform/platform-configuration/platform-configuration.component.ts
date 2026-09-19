import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import {
  AiModelRates,
  CountryConfig,
  LeadDiscoveryModelRates,
  PlatformConfiguration,
  WhatsAppCountryRates,
} from '../../../core/models/platform.model';
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
    quotaWeights: this.fb.group({
      marketing: [0, nonNegative],
      authentication: [0, nonNegative],
      utility: [0, nonNegative],
    }),
    whatsAppDefault: this.categoryRates(),
    whatsAppCountries: this.fb.array<FormGroup>([]),
    webSearchPerThousand: [0, nonNegative],
    leadDefault: this.leadRates('Default'),
    leadModels: this.fb.array<FormGroup>([]),
    leadDefaultModel: [''],
    aiModels: this.fb.array<FormGroup>([]),
    aiDefaultModel: [''],
    // One control per country, in catalog order; at least one must stay enabled.
    countries: this.fb.array<FormGroup>([], [PlatformConfigurationComponent.atLeastOneEnabled]),
  });

  loading = true;
  saving = false;
  loadFailed = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly configuration: PlatformConfigurationService,
    private readonly notify: NotificationService
  ) {}

  /** The rate table's rows - the countries that are switched on. */
  get countries(): FormArray<FormGroup> {
    return this.form.controls.whatsAppCountries;
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

  ngOnInit(): void {
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
    const { refunds, alerts, trial, quotaWeights, charges } = config;

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
      quotaWeights,
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
      quotaWeights: v.quotaWeights,
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

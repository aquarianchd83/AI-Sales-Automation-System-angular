import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, finalize, switchMap, takeUntil, tap } from 'rxjs/operators';

import { QUOTA_TYPE_LABELS, QuotaType, RegionOption, formatCharge } from '../../../core/models/billing.model';
import { CreditPackCostCountry, CreditPackCostReport, PlatformCreditPack } from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { countryPriceRows, newCountryPriceRow, toCountryPriceInputs } from '../country-price-editor/country-price-editor.component';

export interface PlatformCreditPackFormDialogData {
  /** Null means "create a new pack" - otherwise the pack being edited. */
  pack: PlatformCreditPack | null;
}

/** Add/edit form for one credit pack. The quota type is fixed once a pack exists (a pack sold as WhatsApp credits
 * must not silently become lead credits under tenants' feet), so it is disabled in edit mode. The price is entered
 * in dollars and converted to cents at the edge, like the plan dialog. */
@Component({
  selector: 'app-platform-credit-pack-form-dialog',
  templateUrl: './platform-credit-pack-form-dialog.component.html',
  styles: [
    `
      .cost-panel {
        margin: 8px 0 16px;
        padding: 12px 14px 14px;
        border: 1px solid rgba(128, 128, 128, 0.35);
        border-radius: 8px;
      }
      .cost-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cost-note {
        margin: 4px 0 12px;
        font-size: 12px;
      }
      .cost-summary {
        margin: 12px 0 8px;
      }
      .cost-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .cost-table th {
        text-align: left;
        font-weight: 500;
        opacity: 0.7;
        padding: 4px 8px 6px 0;
      }
      .cost-table td {
        padding: 2px 8px 2px 0;
        border-top: 1px solid rgba(128, 128, 128, 0.2);
      }
      .cost-inr {
        font-size: 11px;
      }
      .use-all {
        margin-top: 10px;
      }
      .cost-warnings {
        list-style: none;
        padding: 0;
        margin: 8px 0;
        color: var(--mat-sys-error, #b3261e);
        font-size: 12px;
      }
      .cost-warnings li {
        display: flex;
        gap: 6px;
        align-items: center;
      }
    `,
  ],
})
export class PlatformCreditPackFormDialogComponent implements OnInit, OnDestroy {
  readonly formatCharge = formatCharge;
  readonly isEditMode = this.data.pack !== null;
  readonly quotaTypes = [QuotaType.WhatsAppMessages, QuotaType.AiConversations, QuotaType.LeadCandidates];
  readonly quotaLabels = QUOTA_TYPE_LABELS;

  readonly form = this.fb.group({
    quotaType: [
      { value: this.data.pack?.quotaType ?? QuotaType.WhatsAppMessages, disabled: this.isEditMode },
      [Validators.required],
    ],
    name: [this.data.pack?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    units: [this.data.pack?.units ?? 1000, [Validators.required, Validators.min(1)]],
    isActive: [this.data.pack?.isActive ?? true],
    // Not saved with the pack: the margin wanted over cost, used only to suggest a price from the Configuration charges.
    marginPercent: [50, [Validators.required, Validators.min(0), Validators.max(1000)]],
  });

  /** What this pack costs to serve and the price that leaves the margin, from the Configuration page's charges. */
  cost: CreditPackCostReport | null = null;
  costLoading = false;
  costFailed = false;

  private readonly destroy$ = new Subject<void>();

  readonly countryPrices = countryPriceRows(this.data.pack?.countryPrices);
  regions: RegionOption[] = [];

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly billing: PlatformBillingService,
    regionSource: BillingService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformCreditPackFormDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformCreditPackFormDialogData
  ) {
    regionSource.getRegions().subscribe({
      // The countries switched on, plus any that already carries a price here - a country switched off later keeps its
      // price and stays editable, rather than the row silently losing its label.
      next: (regions) => {
        const known = new Set(regions.map((r) => r.countryCode));
        const kept = (this.data.pack?.countryPrices ?? [])
          .filter((p) => !known.has(p.countryCode))
          .map((p) => ({ countryCode: p.countryCode, countryName: p.countryName + ' (off)', currencyCode: p.currencyCode, currencySymbol: p.currencySymbol }));
        this.regions = [...regions, ...kept];
        // A new pack starts with India's row: the platform is based there, so the price is entered in rupees.
        if (!this.data.pack && this.countryPrices.length === 0) {
          this.countryPrices.push(newCountryPriceRow('IN', 0));
        }
      },
      error: () => {},
    });
  }

  ngOnInit(): void {
    // Recalculates as the type, size or margin change; a short pause keeps it from calling on every keystroke.
    this.form.valueChanges
      .pipe(
        debounceTime(350),
        tap(() => {
          this.costLoading = true;
          this.costFailed = false;
        }),
        switchMap(() => this.loadCost()),
        takeUntil(this.destroy$)
      )
      .subscribe((report) => this.showCost(report));

    this.loadCost().subscribe((report) => this.showCost(report));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Puts the suggested price for every country into the price rows below (replacing what is there). */
  useSuggestedPrices(): void {
    if (!this.cost) {
      return;
    }
    this.countryPrices.clear();
    for (const c of this.cost.countries.filter((x) => x.suggestedPriceLocal > 0)) {
      this.countryPrices.push(newCountryPriceRow(c.countryCode, c.suggestedPriceLocal));
    }
    this.countryPrices.markAsDirty();
  }

  /** Sets one country's price to its suggestion, adding the row if it has none yet. */
  useSuggestedPrice(country: CreditPackCostCountry): void {
    const existing = this.countryPrices.controls.find((r) => r.controls.countryCode.value === country.countryCode);
    if (existing) {
      existing.controls.amount.setValue(country.suggestedPriceLocal);
    } else {
      this.countryPrices.push(newCountryPriceRow(country.countryCode, country.suggestedPriceLocal));
    }
    this.countryPrices.markAsDirty();
  }

  private loadCost() {
    const raw = this.form.getRawValue();
    const units = Number(raw.units) || 0;
    if (units <= 0) {
      return of<CreditPackCostReport | null>(null);
    }
    return this.billing
      .buildCreditPackCost({ quotaType: raw.quotaType, units, marginPercent: Number(raw.marginPercent) || 0 })
      .pipe(
        catchError(() => {
          this.costFailed = true;
          return of<CreditPackCostReport | null>(null);
        })
      );
  }

  private showCost(report: CreditPackCostReport | null): void {
    this.costLoading = false;
    if (report) {
      this.cost = report;
    }
  }

  save(): void {
    if (this.form.invalid || this.countryPrices.invalid || this.saving) {
      this.form.markAllAsTouched();
      this.countryPrices.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    // The price is the country prices below; the server derives the one legacy USD figure.
    const priceCents = 0;

    this.saving = true;
    const request$ = this.isEditMode
      ? this.billing.updateCreditPack(this.data.pack!.id, {
          name: raw.name.trim(),
          units: raw.units,
          priceCents,
          isActive: raw.isActive,
          countryPrices: toCountryPriceInputs(this.countryPrices),
        })
      : this.billing.createCreditPack({ quotaType: raw.quotaType, name: raw.name.trim(), units: raw.units, priceCents, countryPrices: toCountryPriceInputs(this.countryPrices) });

    request$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEditMode ? 'Credit pack updated.' : 'Credit pack created.');
        this.dialogRef.close(true);
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

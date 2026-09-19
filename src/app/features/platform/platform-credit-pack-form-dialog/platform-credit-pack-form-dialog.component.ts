import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { QUOTA_TYPE_LABELS, QuotaType, RegionOption } from '../../../core/models/billing.model';
import { PlatformCreditPack } from '../../../core/models/platform.model';
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
})
export class PlatformCreditPackFormDialogComponent {
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
  });

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

import { Component, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { RegionOption } from '../../../core/models/billing.model';
import { CountryPrice, CountryPriceInput } from '../../../core/models/platform.model';

export type CountryPriceRow = FormGroup<{
  countryCode: FormControl<string>;
  amount: FormControl<number>;
}>;

export function newCountryPriceRow(countryCode = '', amount = 0): CountryPriceRow {
  return new FormGroup({
    countryCode: new FormControl(countryCode, { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl(amount, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
  });
}

export function countryPriceRows(prices: CountryPrice[] | undefined | null): FormArray<CountryPriceRow> {
  return new FormArray((prices ?? []).map((p) => newCountryPriceRow(p.countryCode, p.amount)));
}

/** The complete set to send: a country left out of it loses its price (it falls back to the converted USD price). */
export function toCountryPriceInputs(rows: FormArray<CountryPriceRow>): CountryPriceInput[] {
  return rows.getRawValue().map((r) => ({ countryCode: r.countryCode, amount: r.amount }));
}

/**
 * Edits the explicit per-country prices of a plan or credit pack. Each row is a country and the price in that
 * country's own currency; a country with no row is quoted the USD price converted at the platform rate. The
 * FormArray belongs to the host dialog, so the dialog's own validity and save cover these rows too.
 */
@Component({
  selector: 'app-country-price-editor',
  templateUrl: './country-price-editor.component.html',
  styles: [
    `
      .country-price-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .country-select {
        flex: 1 1 55%;
      }
      .amount-field {
        flex: 1 1 35%;
      }
    `,
  ],
})
export class CountryPriceEditorComponent {
  @Input() rows!: FormArray<CountryPriceRow>;
  @Input() regions: RegionOption[] = [];

  /** Countries not already priced by another row - one price per country. */
  availableRegions(current: string): RegionOption[] {
    const taken = new Set(this.rows.controls.map((r) => r.controls.countryCode.value).filter((c) => c && c !== current));
    return this.regions.filter((r) => !taken.has(r.countryCode));
  }

  symbolFor(countryCode: string): string {
    return this.regions.find((r) => r.countryCode === countryCode)?.currencySymbol ?? '';
  }

  currencyFor(countryCode: string): string {
    return this.regions.find((r) => r.countryCode === countryCode)?.currencyCode ?? '';
  }

  get canAdd(): boolean {
    return this.regions.length > this.rows.length;
  }

  add(): void {
    this.rows.push(newCountryPriceRow());
  }

  remove(index: number): void {
    this.rows.removeAt(index);
  }
}

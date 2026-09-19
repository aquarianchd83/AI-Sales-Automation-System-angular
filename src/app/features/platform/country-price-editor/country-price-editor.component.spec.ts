import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SharedModule } from '../../../shared/shared.module';
import {
  CountryPriceEditorComponent,
  countryPriceRows,
  newCountryPriceRow,
  toCountryPriceInputs,
} from './country-price-editor.component';

const REGIONS = [
  { countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹' },
  { countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£' },
];

describe('CountryPriceEditorComponent', () => {
  function create(rows = countryPriceRows([])) {
    TestBed.configureTestingModule({
      declarations: [CountryPriceEditorComponent],
      imports: [SharedModule, NoopAnimationsModule],
    });
    const fixture = TestBed.createComponent(CountryPriceEditorComponent);
    fixture.componentInstance.rows = rows;
    fixture.componentInstance.regions = REGIONS;
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('shows a row per country price with the country\'s currency symbol', () => {
    const { root } = create(countryPriceRows([{ countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹', amount: 999 }]));

    expect(root.querySelectorAll('.country-price-row').length).toBe(1);
    expect(root.textContent).toContain('₹');
  });

  it('adds and removes rows', () => {
    const { component, fixture, root } = create();

    component.add();
    fixture.detectChanges();
    expect(root.querySelectorAll('.country-price-row').length).toBe(1);

    component.remove(0);
    fixture.detectChanges();
    expect(root.querySelectorAll('.country-price-row').length).toBe(0);
  });

  it('offers a country only once - one already priced is not offered to another row', () => {
    const rows = countryPriceRows([]);
    rows.push(newCountryPriceRow('IN', 10));
    rows.push(newCountryPriceRow('', 0));
    const { component } = create(rows);

    expect(component.availableRegions('').map((r) => r.countryCode)).toEqual(['GB']);
    expect(component.availableRegions('IN').map((r) => r.countryCode)).toEqual(['IN', 'GB']);
  });

  it('cannot add more rows than there are countries', () => {
    const rows = countryPriceRows([]);
    rows.push(newCountryPriceRow('IN', 1));
    rows.push(newCountryPriceRow('GB', 1));
    const { component } = create(rows);

    expect(component.canAdd).toBeFalse();
  });

  it('turns rows into the request shape', () => {
    const rows = countryPriceRows([]);
    rows.push(newCountryPriceRow('GB', 40));

    expect(toCountryPriceInputs(rows)).toEqual([{ countryCode: 'GB', amount: 40 }]);
  });
});

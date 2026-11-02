import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformRevenueReport } from '../../../core/models/platform.model';
import { PlatformRevenueService } from '../../../core/services/platform-revenue.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformRevenueComponent } from './platform-revenue.component';

const figures = (net: number, refunds = 0) => ({ gross: net + refunds, refunds, net, tax: 0, netExTax: net, payments: 2, refundCount: refunds ? 1 : 0 });

const report: PlatformRevenueReport = {
  fromUtc: '2026-10-01T00:00:00Z',
  toUtc: '2026-11-30T23:59:59Z',
  totals: figures(1800, 200),
  previous: figures(1000),
  byKind: [],
  months: [
    { month: '2026-10', subscription: 1000, creditPack: 0, refunds: 0, net: 1000 },
    { month: '2026-11', subscription: 500, creditPack: 500, refunds: 200, net: 800 },
  ],
  topTenants: [],
  countries: [],
};

describe('PlatformRevenueComponent', () => {
  let fixture: ComponentFixture<PlatformRevenueComponent>;
  let component: PlatformRevenueComponent;
  const get = jasmine.createSpy('get').and.returnValue(of(report));

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PlatformRevenueComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: PlatformRevenueService, useValue: { get } }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(PlatformRevenueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('compares each tile with the period before', () => {
    const net = component.tiles.find((t) => t.label === 'Net revenue')!;
    expect(net.change).toBe(80);
    expect(component.changeGood(net)).toBeTrue();

    const refunds = component.tiles.find((t) => t.label === 'Refunds')!;
    expect(refunds.change).toBeNull();
  });

  it('treats more refunds as bad', () => {
    const tile = { label: 'Refunds', value: '', hint: '', change: 50, upIsGood: false };
    expect(component.changeGood(tile)).toBeFalse();
  });

  it('stacks subscriptions under credit packs, scaled to the tallest month', () => {
    expect(component.maxMonth).toBe(1000);
    const [oct, nov] = component.bars;
    expect(oct.packH).toBe(0);
    expect(nov.subscriptionH).toBeCloseTo(nov.packH, 5);
    expect(nov.packY + nov.packH + nov.subscriptionH).toBeCloseTo(component.chartHeight, 5);
  });

  it('formats rupees with Indian grouping', () => {
    expect(component.inr(1234567)).toBe('₹12,34,567');
    expect(component.inr(12.5)).toBe('₹12.50');
  });

  it('sends the chosen days, not shifted by the time zone', () => {
    component.fromControl.setValue(new Date(2026, 9, 1));
    component.toControl.setValue(new Date(2026, 9, 31));
    component.apply();
    expect(get).toHaveBeenCalledWith('2026-10-01', '2026-10-31');
  });
});

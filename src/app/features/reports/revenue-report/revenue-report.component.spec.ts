import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SharedModule } from '../../../shared/shared.module';
import { MarketingComparison, RevenueReport } from '../../../core/models/report.model';
import { RevenueReportComponent, barPercent, formatAmount, formatChange } from './revenue-report.component';

const report: RevenueReport = {
  months: 3,
  granularity: 'Month',
  from: '2026-07-01T00:00:00Z',
  to: '2026-09-21T12:00:00Z',
  totalRevenue: 21000,
  salesCount: 6,
  averageSale: 3500,
  uniqueCustomers: 4,
  previousRevenue: 2000,
  previousSalesCount: 1,
  revenueChangePercent: 950,
  expectedRevenue: 147000,
  targetAchievedPercent: 14.3,
  mostPopularPackage: 'Gold',
  topRevenuePackage: 'Gold',
  trend: [
    { start: '2026-07-01T00:00:00Z', revenue: 5000, sales: 1 },
    { start: '2026-08-01T00:00:00Z', revenue: 6000, sales: 3 },
    { start: '2026-09-01T00:00:00Z', revenue: 10000, sales: 2 },
  ],
  packages: [
    { packageId: 'g', name: 'Gold', isActive: true, price: 5000, salesCount: 3, revenue: 15000, salesSharePercent: 50, revenueSharePercent: 71.4, uniqueCustomers: 2, targetSales: 12, rank: 1 },
    { packageId: 's', name: 'Silver', isActive: true, price: 2000, salesCount: 3, revenue: 6000, salesSharePercent: 50, revenueSharePercent: 28.6, uniqueCustomers: 2, targetSales: 30, rank: 2 },
    { packageId: 'p', name: 'Platinum', isActive: true, price: 9000, salesCount: 0, revenue: 0, salesSharePercent: 0, revenueSharePercent: 0, uniqueCustomers: 0, targetSales: 3, rank: 0 },
  ],
};

const comparison: MarketingComparison = {
  months: 3,
  spendSource: 'Meta',
  connectionStatus: 'Connected',
  spendCurrencyCode: 'INR',
  tenantCurrencyCode: 'INR',
  currencyMatches: true,
  revenue: 21000,
  sales: 6,
  social: { spend: 12000, impressions: 90000, clicks: 600, leads: 40, costPerClick: 20, costPerLead: 300, costPerSale: 2000, returnOnSpend: 1.75 },
  whatsApp: { cost: 900, messagesSent: 1200, costPerSale: 150, returnOnSpend: 23.33 },
  cheaperChannel: 'WhatsApp',
  savingsPerSale: 1850,
  platforms: [
    { platform: 'facebook', spend: 8000, sharePercent: 66.7, clicks: 400, leads: 25 },
    { platform: 'instagram', spend: 4000, sharePercent: 33.3, clicks: 200, leads: 15 },
  ],
  spendTrend: [
    { start: '2026-07-01T00:00:00Z', spend: 3000 },
    { start: '2026-08-01T00:00:00Z', spend: 4000 },
    { start: '2026-09-01T00:00:00Z', spend: 5000 },
  ],
};

describe('revenue report helpers', () => {
  it('formats amounts with grouping and at most two decimals', () => {
    expect(formatAmount(1234.5)).toBe('1,234.5');
    expect(formatAmount(21000)).toBe('21,000');
    expect(formatAmount(0.456)).toBe('0.46');
  });

  it('draws a bar relative to the biggest but never lets a non-zero value vanish', () => {
    expect(barPercent(50, 100)).toBe(50);
    expect(barPercent(1, 1000)).toBe(2);
    expect(barPercent(0, 100)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
  });

  it('always shows the sign of a change, and nothing when there is no baseline', () => {
    expect(formatChange(12.54)).toBe('+12.5%');
    expect(formatChange(-3)).toBe('-3%');
    expect(formatChange(0)).toBe('0%');
    expect(formatChange(null)).toBeNull();
  });
});

describe('RevenueReportComponent', () => {
  let fixture: ComponentFixture<RevenueReportComponent>;
  let component: RevenueReportComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RevenueReportComponent],
      imports: [SharedModule, HttpClientTestingModule, RouterTestingModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(RevenueReportComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushInitial(body: RevenueReport = report, marketing: MarketingComparison | null = comparison): void {
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/tenant-settings/charges')).flush({ currencySymbol: '₹', currencyCode: 'INR' });
    const req = http.expectOne((r) => r.url.endsWith('/reports/revenue'));
    expect(req.request.params.get('months')).toBe('3');
    req.flush(body);
    const cmp = http.expectOne((r) => r.url.endsWith('/reports/revenue/marketing-comparison'));
    expect(cmp.request.params.get('months')).toBe('3');
    if (marketing) {
      cmp.flush(marketing);
    } else {
      cmp.flush('x', { status: 500, statusText: 'Server Error' });
    }
    fixture.detectChanges();
  }

  it('loads three months by default and names the most popular package', () => {
    flushInitial();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.topPackage?.name).toBe('Gold');
    expect(text).toContain('Most popular package');
    expect(text).toContain('+950%');
    expect(component.unsoldPackages.map((p) => p.name)).toEqual(['Platinum']);
  });

  it('asks for the new period when it is changed and keeps the chosen period if a slow answer arrives late', () => {
    flushInitial();

    component.setPeriod(24);
    const slow = http.expectOne((r) => r.url.endsWith('/reports/revenue'));
    const slowCmp = http.expectOne((r) => r.url.endsWith('/reports/revenue/marketing-comparison'));
    expect(slow.request.params.get('months')).toBe('24');

    component.setPeriod(6);
    const latest = http.expectOne((r) => r.url.endsWith('/reports/revenue'));
    const latestCmp = http.expectOne((r) => r.url.endsWith('/reports/revenue/marketing-comparison'));
    expect(latest.request.params.get('months')).toBe('6');

    slow.flush({ ...report, months: 24, totalRevenue: 1 });
    slowCmp.flush({ ...comparison, months: 24, revenue: 1 });
    expect(component.report?.totalRevenue).toBe(21000);
    expect(component.marketing?.revenue).toBe(21000);

    latest.flush({ ...report, months: 6, totalRevenue: 777 });
    latestCmp.flush({ ...comparison, months: 6, revenue: 777 });
    expect(component.report?.totalRevenue).toBe(777);
    expect(component.marketing?.revenue).toBe(777);
  });

  it('points an empty tenant at recording a sale instead of showing zeros', () => {
    flushInitial({ ...report, salesCount: 0, totalRevenue: 0, trend: [], packages: [] });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No sales in the last');
    expect(text).not.toContain('Most popular package');
  });

  it('offers a retry when the report cannot be loaded', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/tenant-settings/charges')).flush({ currencySymbol: '₹' });
    http.expectOne((r) => r.url.endsWith('/reports/revenue')).flush('x', { status: 500, statusText: 'Server Error' });
    http.expectOne((r) => r.url.endsWith('/reports/revenue/marketing-comparison')).flush(comparison);
    fixture.detectChanges();

    expect(component.failed).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('could not be loaded');
  });

  it('says which channel was cheaper per sale and by how much', () => {
    flushInitial();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Social media vs WhatsApp');
    expect(text).toContain('WhatsApp won more sales for less');
    expect(text).toContain('₹1,850 less per sale');
    expect(text).toContain('Facebook');
    expect(text).toContain('Instagram');
  });

  it('invites a tenant with no ad spend to connect Facebook instead of showing zeros', () => {
    flushInitial(report, {
      ...comparison,
      spendSource: 'None',
      connectionStatus: 'NotConnected',
      spendCurrencyCode: null,
      cheaperChannel: null,
      savingsPerSale: null,
      platforms: [],
    });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('See what your social media ads cost');
    expect(text).toContain('Connect Facebook');
    expect(text).not.toContain('won more sales for less');
  });

  it('shows ad spend in the ad currency, not the tenant symbol, when the currencies differ, and withholds the verdict', () => {
    flushInitial(report, {
      ...comparison,
      currencyMatches: false,
      spendCurrencyCode: 'USD',
      cheaperChannel: null,
      savingsPerSale: null,
      social: { ...comparison.social, costPerSale: null, returnOnSpend: null },
    });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.socialMoney(500)).toBe('USD 500');
    expect(text).toContain('bills in USD');
    expect(text).not.toContain('won more sales for less');
  });

  it('tells the tenant when the Facebook login has lapsed', () => {
    flushInitial(report, { ...comparison, connectionStatus: 'NeedsReconnect' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reconnect Facebook');
  });

  it('keeps the revenue figures when only the comparison fails to load', () => {
    flushInitial(report, null);

    expect(component.report?.totalRevenue).toBe(21000);
    expect(component.marketing).toBeNull();
    expect(component.marketingFailed).toBeTrue();
  });
});

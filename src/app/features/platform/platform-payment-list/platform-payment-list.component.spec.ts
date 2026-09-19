import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformPaymentListItem } from '../../../core/models/platform.model';
import { PlatformPaymentService } from '../../../core/services/platform-payment.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformPaymentListComponent } from './platform-payment-list.component';

const payment = (extra: Partial<PlatformPaymentListItem> = {}): PlatformPaymentListItem => ({
  id: 'p1',
  tenantId: 't1',
  tenantName: 'Acme',
  kind: 'Subscription',
  description: 'Growth',
  amountCents: 9900,
  currencyCode: 'INR',
  currencySymbol: '₹',
  localAmount: 8217,
  provider: 'Simulated',
  paidAtUtc: '2026-09-10T00:00:00Z',
  refundOfPaymentId: null,
  ...extra,
});

describe('PlatformPaymentListComponent', () => {
  function render(items: PlatformPaymentListItem[]) {
    const getPaged = jasmine
      .createSpy('getPaged')
      .and.returnValue(of({ items, totalCount: items.length, page: 1, pageSize: 25, totalPages: 1 }));

    TestBed.configureTestingModule({
      declarations: [PlatformPaymentListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: PlatformPaymentService, useValue: { getPaged } }],
    });

    const fixture = TestBed.createComponent(PlatformPaymentListComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, getPaged };
  }

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  const upcoming = (over: Partial<PlatformPaymentListItem> = {}): PlatformPaymentListItem =>
    payment({
      id: 's1', tenantName: 'Confianza IT Solutions', description: 'silver', paidAtUtc: null, provider: '',
      status: 'Upcoming', dueAtUtc: '2026-10-19T10:54:00Z',
      localAmount: 2500, taxLocal: 450, totalLocal: 2950, amountInr: 2950,
      taxLines: [{ name: 'IGST', ratePercent: 18, amount: 450 }],
      ...over,
    });

  it('shows an upcoming monthly subscription in the same grid, before any payment exists', () => {
    const { root } = render([upcoming()]);

    const rows = root.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(1);
    const row = text(rows[0]);
    expect(row).toContain('Confianza IT Solutions');
    expect(row).toContain('Due 19 Oct 2026');
    expect(row).toContain('Upcoming');
    expect(row).toContain('₹2950.00');
    expect(row).toContain('IGST 18%');
    expect(rows[0].classList).toContain('upcoming-row');
  });

  it('marks paid rows as paid and lists the upcoming ones apart from them', () => {
    const { root } = render([upcoming(), payment({ id: 'p9' })]);

    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row'));
    expect(text(rows[0])).toContain('Upcoming');
    expect(text(rows[1])).toContain('Paid');
    expect(rows[1].classList).not.toContain('upcoming-row');
  });

  it('says No price for a plan the tenant country does not price, and Not scheduled for one with no billing period', () => {
    const { root } = render([
      upcoming({ id: 's2', status: 'NoPrice', countryCode: 'DE', totalLocal: 0, localAmount: 0, amountInr: 0, taxLocal: 0, taxLines: [] }),
      upcoming({ id: 's3', status: 'NotScheduled', dueAtUtc: null }),
    ]);

    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row')).map((r) => text(r));
    expect(rows[0]).toContain('No price');
    expect(rows[0]).toContain('No price in DE');
    expect(rows[1]).toContain('Not scheduled');
  });

  it('keeps upcoming charges out of the rupee total, which is money that moved', () => {
    const { fixture } = render([upcoming(), payment({ amountInr: 1178.82 })]);

    expect(fixture.componentInstance.pageTotalInr).toBeCloseTo(1178.82, 2);
  });

  it('lists payments with their type and tenant link', () => {
    const { root } = render([payment(), payment({ id: 'p2', kind: 'CreditPack', description: '1,000 AI conversations' })]);

    const rows = root.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(2);
    expect(text(rows[0])).toContain('Plan subscription');
    expect(text(rows[1])).toContain('Credit pack');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/platform/tenants/t1');
  });

  it('totals the page in rupees, whatever each tenant paid in, and nets refunds off', () => {
    const { fixture } = render([
      payment({ amountInr: 9696.06 }),
      payment({ id: 'p2', kind: 'Refund', amountInr: -1000 }),
      payment({ id: 'p3', currencyCode: 'USD', currencySymbol: '$', localAmount: 39, amountInr: 3237 }),
    ]);

    expect(fixture.componentInstance.pageTotalInr).toBeCloseTo(11933.06, 2);
  });

  it('shows what was paid including tax, with the tax spelled out, and the rupee value', () => {
    const { root } = render([
      payment({
        localAmount: 999,
        taxLocal: 179.82,
        totalLocal: 1178.82,
        amountInr: 1178.82,
        countryCode: 'IN',
        taxLines: [
          { name: 'CGST', ratePercent: 9, amount: 89.91 },
          { name: 'SGST', ratePercent: 9, amount: 89.91 },
        ],
      }),
    ]);

    const row = text(root.querySelector('tr.mat-mdc-row'));
    expect(row).toContain('₹1178.82');
    expect(row).toContain('CGST 9%');
    expect(row).toContain('SGST 9%');
    expect(row).toContain('IN');
  });

  it('shows a payment from before tax was recorded at its price, with no rupee value if none was stored', () => {
    const { root } = render([payment({ localAmount: 8217, totalLocal: 0, taxLocal: 0, amountInr: 0 })]);

    const row = text(root.querySelector('tr.mat-mdc-row'));
    expect(row).toContain('₹8217.00');
    expect(row).not.toContain('incl.');
  });

  it('shows an empty state when nothing matches', () => {
    const { root } = render([]);

    expect(text(root.querySelector('.empty-state'))).toContain('No payments match');
  });

  it('sends the chosen type to the API', () => {
    const { fixture, getPaged } = render([payment()]);

    fixture.componentInstance.kindControl.setValue('Refund');

    expect(getPaged.calls.mostRecent().args[0].kind).toBe('Refund');
  });
});

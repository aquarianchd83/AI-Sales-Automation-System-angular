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

  it('lists payments with their type and tenant link', () => {
    const { root } = render([payment(), payment({ id: 'p2', kind: 'CreditPack', description: '1,000 AI conversations' })]);

    const rows = root.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(2);
    expect(text(rows[0])).toContain('Plan subscription');
    expect(text(rows[1])).toContain('Credit pack');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/platform/tenants/t1');
  });

  it('totals the page per currency and nets refunds off', () => {
    const { fixture } = render([
      payment({ localAmount: 8217, amountCents: 9900 }),
      payment({ id: 'p2', kind: 'Refund', localAmount: -1000, amountCents: -1200 }),
      payment({ id: 'p3', currencyCode: 'USD', currencySymbol: '$', localAmount: 39, amountCents: 3900 }),
    ]);

    const totals = fixture.componentInstance.pageTotals;
    expect(totals.length).toBe(2);
    expect(totals.find((t) => t.currencyCode === 'INR')?.amount).toBe(7217);
    expect(totals.find((t) => t.currencyCode === 'USD')?.amount).toBe(39);
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

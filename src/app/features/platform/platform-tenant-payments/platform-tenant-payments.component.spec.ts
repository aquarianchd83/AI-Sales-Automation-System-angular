import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PagedResult } from '../../../core/models/paged-result.model';
import { PlatformPaymentListItem } from '../../../core/models/platform.model';
import { PlatformPaymentService } from '../../../core/services/platform-payment.service';
import { PlatformRevenueService } from '../../../core/services/platform-revenue.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTenantPaymentsComponent } from './platform-tenant-payments.component';

const row = (over: Partial<PlatformPaymentListItem>): PlatformPaymentListItem =>
  ({
    id: 'p',
    tenantId: 't1',
    tenantName: 'Acme',
    kind: 'Subscription',
    description: 'Growth',
    amountCents: 1000,
    currencyCode: 'INR',
    currencySymbol: '₹',
    localAmount: 999,
    provider: 'Razorpay',
    paidAtUtc: '2026-10-05T10:00:00Z',
    refundOfPaymentId: null,
    amountInr: 999,
    status: 'Paid',
    ...over,
  } as PlatformPaymentListItem);

const rows = [
  row({ id: 'u', status: 'Upcoming', paidAtUtc: null, dueAtUtc: '2026-11-05T00:00:00Z' }),
  row({ id: 'p2', kind: 'CreditPack', description: '1000 credits', paidAtUtc: '2026-10-20T10:00:00Z' }),
  row({ id: 'p1' }),
];

const page = (items: PlatformPaymentListItem[]): PagedResult<PlatformPaymentListItem> => ({ items, totalCount: items.length, page: 1, pageSize: 25 } as PagedResult<PlatformPaymentListItem>);

describe('PlatformTenantPaymentsComponent', () => {
  let fixture: ComponentFixture<PlatformTenantPaymentsComponent>;
  let getPaged: jasmine.Spy;
  const totals = { gross: 12500, refunds: 500, net: 12000, tax: 1830, netExTax: 10170, payments: 3, refundCount: 1 };
  const revenueGet = jasmine.createSpy('get').and.callFake(() => of({ totals }));

  beforeEach(() => {
    getPaged = jasmine.createSpy('getPaged').and.callFake(() => of(page(rows)));
    TestBed.configureTestingModule({
      declarations: [PlatformTenantPaymentsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 't1' }) } } },
        { provide: PlatformPaymentService, useValue: { getPaged } },
        { provide: PlatformRevenueService, useValue: { get: revenueGet } },
        { provide: PlatformTenantService, useValue: { getById: () => of({ id: 't1', name: 'Acme Traders' }) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(PlatformTenantPaymentsComponent);
    fixture.detectChanges();
  });

  it('asks for this tenant\'s payments only, and names the tenant', () => {
    expect(getPaged).toHaveBeenCalledWith(jasmine.objectContaining({ tenantId: 't1' }));
    expect(getPaged.calls.allArgs().every(([q]) => q.tenantId === 't1')).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=tenant-name]')?.textContent).toContain('Acme Traders');
  });

  it('shows the tenant\'s total payment for its whole history', () => {
    expect(revenueGet).toHaveBeenCalledWith(undefined, undefined, 't1');
    const net = (fixture.nativeElement as HTMLElement).querySelector('[data-testid=total-net]')?.textContent ?? '';
    expect(net).toContain('12,000');
  });

  it('reminds when the next subscription is due and when a credit pack was last bought', () => {
    const [subscription, pack] = fixture.componentInstance.reminders;
    expect(subscription.headline).toContain('Next charge due');
    expect(subscription.attention).toBeTrue();
    expect(subscription.detail).toContain('Last processed');
    expect(pack.headline).toContain('Last bought');
    expect(pack.detail).toContain('1000 credits');
  });

  it('filters by type from the first page again', () => {
    fixture.componentInstance.kindControl.setValue('CreditPack');
    expect(getPaged).toHaveBeenCalledWith(jasmine.objectContaining({ tenantId: 't1', kind: 'CreditPack', page: 1 }));
  });

  it('shows the grid rows in the order the API gives, upcoming first', () => {
    const cells = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tr.mat-mdc-row')).map((r) => r.textContent ?? '');
    expect(cells.length).toBe(3);
    expect(cells[0]).toContain('Due');
  });
});

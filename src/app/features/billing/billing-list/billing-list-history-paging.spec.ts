import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { Payment, RefundRequest, RefundStatus } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { BillingListComponent } from './billing-list.component';

const payment = (n: number): Payment =>
  ({ id: `p${n}`, planName: `Payment ${n}`, amountCents: 1000, currencyCode: 'INR', currencySymbol: '₹', localAmount: 100, provider: 'Simulated', paidAtUtc: '2026-09-15T00:00:00Z', kind: 'Subscription' }) as Payment;

const refund = (n: number): RefundRequest =>
  ({ id: `r${n}`, paymentId: `pay-${n}`, paymentDescription: `Refund ${n}`, status: RefundStatus.Requested, currencySymbol: '₹', eligibleLocalAmount: 10, createdAt: '2026-09-16T00:00:00Z', reviewNote: null }) as unknown as RefundRequest;

describe('BillingListComponent history paging', () => {
  function render(payments: number, refunds: number) {
    const billing = {
      getPlans: () => of([]),
      getSubscription: () => of(null),
      getQuota: () => of([]),
      getPaymentHistory: () => of(Array.from({ length: payments }, (_, i) => payment(i + 1))),
      getCapabilities: () => of({ refundRequestsEnabled: true }),
      getRefundRequests: () => of(Array.from({ length: refunds }, (_, i) => refund(i + 1))),
    };
    TestBed.configureTestingModule({
      declarations: [BillingListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: BillingService, useValue: billing }],
    });
    const fixture = TestBed.createComponent(BillingListComponent);
    fixture.detectChanges();
    return fixture;
  }

  const rows = (root: HTMLElement, selector: string) => root.querySelectorAll(selector).length;

  it('opens each history with 10 rows and reveals the rest 10 at a time', () => {
    const fixture = render(25, 14);
    const root = fixture.nativeElement as HTMLElement;

    expect(rows(root, '.payment-row')).toBe(10);
    expect(rows(root, '.refund-row')).toBe(10);

    fixture.componentInstance.showMorePayments();
    fixture.componentInstance.showMoreRefunds();
    fixture.detectChanges();
    expect(rows(root, '.payment-row')).toBe(20);
    expect(rows(root, '.refund-row')).toBe(14);

    fixture.componentInstance.showMorePayments();
    fixture.detectChanges();
    expect(rows(root, '.payment-row')).toBe(25);
    expect(root.querySelector('.load-more')).toBeNull();
  });

  it('offers no more-rows marker when everything already fits', () => {
    const root = render(4, 2).nativeElement as HTMLElement;

    expect(rows(root, '.payment-row')).toBe(4);
    expect(root.querySelector('.load-more')).toBeNull();
  });
});

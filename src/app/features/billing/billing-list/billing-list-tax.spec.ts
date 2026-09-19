import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { Payment, Plan, QuotaType } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { BillingListComponent } from './billing-list.component';

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'plan-1', code: 'growth', name: 'Growth', maxUsers: 5, maxMessagesPerMonth: 5000, maxCampaigns: 10,
  maxKnowledgeBaseArticles: 50, maxLeadDiscoveryBatchSize: 25, priceMonthlyCents: 1204, currencyCode: 'INR', currencySymbol: '₹',
  localPriceAmount: 999, includedQuotas: [{ quotaType: QuotaType.WhatsAppMessages, units: 5000 }],
  taxLines: [
    { name: 'CGST', ratePercent: 9, amount: 89.91 },
    { name: 'SGST', ratePercent: 9, amount: 89.91 },
  ],
  taxLocal: 179.82,
  totalLocal: 1178.82,
  ...over,
});

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'pay-1', planName: 'Growth', amountCents: 1204, currencyCode: 'INR', currencySymbol: '₹', localAmount: 999, provider: 'Simulated',
  paidAtUtc: '2026-09-15T00:00:00Z', kind: 'Subscription',
  taxLocal: 179.82, totalLocal: 1178.82,
  taxLines: [{ name: 'IGST', ratePercent: 18, amount: 179.82 }],
  ...over,
});

describe('BillingListComponent tax', () => {
  function render(plans: Plan[], payments: Payment[]): HTMLElement {
    const billing = {
      getPlans: () => of(plans),
      getSubscription: () => of(null),
      getPaymentHistory: () => of(payments),
      getCapabilities: () => of({ refundRequestsEnabled: false }),
      getRefundRequests: () => of([]),
    };

    TestBed.configureTestingModule({
      declarations: [BillingListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: BillingService, useValue: billing }],
    });

    const fixture = TestBed.createComponent(BillingListComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows the price, the tax added on top spelled out, and what will be charged', () => {
    const root = render([plan()], []);

    expect(text(root.querySelector('.plan-price'))).toContain('₹999/mo');
    const tax = text(root.querySelector('.plan-tax'));
    expect(tax).toContain('CGST 9%');
    expect(tax).toContain('SGST 9%');
    expect(tax).toContain('₹1,178.82/mo');
  });

  it('shows no tax line where no tax is charged', () => {
    const root = render([plan({ taxLines: [], taxLocal: 0, totalLocal: 999 })], []);

    expect(root.querySelector('.plan-tax')).toBeNull();
  });

  it('shows what a tenant paid, tax included, and how the tax was made up', () => {
    const root = render([], [payment()]);

    const row = text(root.querySelector('.payment-row'));
    expect(row).toContain('₹1,178.82');
    expect(row).toContain('incl. IGST 18% ₹179.82');
  });

  it('shows a payment from before tax was recorded at its price, without a tax note', () => {
    const root = render([], [payment({ taxLocal: undefined, totalLocal: undefined, taxLines: undefined })]);

    const row = text(root.querySelector('.payment-row'));
    expect(row).toContain('₹999');
    expect(row).not.toContain('incl.');
  });

  it('shows a refund as a negative including its share of the tax', () => {
    const root = render([], [payment({ kind: 'Refund', localAmount: -700, taxLocal: -126, totalLocal: -826, taxLines: [{ name: 'IGST', ratePercent: 18, amount: -126 }] })]);

    expect(text(root.querySelector('.payment-row'))).toContain('−₹826');
  });
});

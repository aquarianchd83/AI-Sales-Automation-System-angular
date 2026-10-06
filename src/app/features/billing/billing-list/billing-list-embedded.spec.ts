import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { QuotaType } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { EMBEDDED_IN_ONBOARDING } from '../../../core/tokens/embedded-in-onboarding';
import { SharedModule } from '../../../shared/shared.module';
import { BillingListComponent } from './billing-list.component';

/** The Billing screen shown inside onboarding's "Select Package Plan": just the plans - no payment history, no refund
 * requests, no shortcut to usage and credits. The normal /billing page is unchanged. */
describe('BillingListComponent inside onboarding', () => {
  let billing: jasmine.SpyObj<BillingService>;

  function render(embedded: boolean): HTMLElement {
    billing = jasmine.createSpyObj<BillingService>('BillingService', [
      'getPlans', 'getSubscription', 'getPaymentHistory', 'getCapabilities', 'getRefundRequests',
    ]);
    billing.getPlans.and.returnValue(of([
      {
        id: 'plan-1', code: 'silver', name: 'Silver', maxUsers: 2, maxMessagesPerMonth: 1000, maxCampaigns: 2,
        maxKnowledgeBaseArticles: 20, maxLeadDiscoveryBatchSize: 25, priceMonthlyCents: 3900, currencyCode: 'INR',
        currencySymbol: '₹', localPriceAmount: 3237, taxLines: [], taxLocal: 0, totalLocal: 3237,
        includedQuotas: [{ quotaType: QuotaType.WhatsAppMessages, units: 500 }],
      },
    ]));
    billing.getSubscription.and.returnValue(of(null));
    billing.getPaymentHistory.and.returnValue(of([]));
    billing.getCapabilities.and.returnValue(of({ refundRequestsEnabled: true }));
    billing.getRefundRequests.and.returnValue(of([
      {
        id: 'r', tenantId: 't', tenantName: 'Acme', paymentDescription: 'x', reason: 'x', eligibleAmountCents: 1,
        eligibleLocalAmount: 1, currencyCode: 'INR', currencySymbol: '₹', refundedAmountCents: null,
        refundedLocalAmount: null, reviewNote: null, failureReason: null, createdAt: '', reviewedAtUtc: null,
        paymentId: 'p', status: 0,
      } as never,
    ]));

    TestBed.configureTestingModule({
      declarations: [BillingListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BillingService, useValue: billing },
        ...(embedded ? [{ provide: EMBEDDED_IN_ONBOARDING, useValue: true }] : []),
      ],
    });
    const fixture = TestBed.createComponent(BillingListComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the plans and the current subscription, and nothing about history or usage', () => {
    const root = render(true);

    expect(root.querySelector('.plan-card')).toBeTruthy();
    expect(root.querySelector('.subscription-card')).toBeTruthy();
    expect(root.querySelector('.payment-history-card')).toBeNull();
    expect(root.textContent).not.toContain('Payment history');
    expect(root.textContent).not.toContain('Refund requests');
    expect(root.querySelector('a[href="/billing/wallet"]')).toBeNull();
    expect(root.textContent).not.toContain('Usage & credits');
  });

  it('does not even ask for the history it is not showing', () => {
    render(true);

    expect(billing.getPaymentHistory).not.toHaveBeenCalled();
    expect(billing.getRefundRequests).not.toHaveBeenCalled();
  });

  it('is the full page everywhere else: payment history, refund requests and the usage shortcut', () => {
    const root = render(false);

    expect(root.querySelectorAll('.payment-history-card').length).toBe(2);
    expect(root.textContent).toContain('Payment history');
    expect(root.textContent).toContain('Refund requests');
    expect(root.querySelector('a[href="/billing/wallet"]')).toBeTruthy();
    expect(billing.getPaymentHistory).toHaveBeenCalled();
  });
});

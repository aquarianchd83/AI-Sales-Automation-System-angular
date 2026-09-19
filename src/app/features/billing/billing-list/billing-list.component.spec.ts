import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { Payment, QuotaType, RefundRequest, RefundStatus } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { BillingListComponent } from './billing-list.component';

const payment = (id: string, kind: string, localAmount: number): Payment => ({
  id,
  planName: kind === 'Refund' ? 'Refund: 1,000 AI conversations' : '1,000 AI conversations',
  amountCents: localAmount < 0 ? -2000 : 2000,
  currencyCode: 'INR',
  currencySymbol: '₹',
  localAmount,
  provider: 'Simulated',
  paidAtUtc: '2026-09-15T00:00:00Z',
  kind,
});

describe('BillingListComponent refunds', () => {
  function render(refundsEnabled: boolean, requests: Partial<RefundRequest>[] = []): HTMLElement {
    const billing = {
      getPlans: () =>
        of([
          {
            id: 'plan-1', code: 'starter', name: 'Starter', maxUsers: 2, maxMessagesPerMonth: 1000, maxCampaigns: 2,
            maxKnowledgeBaseArticles: 20, maxLeadDiscoveryBatchSize: 25, priceMonthlyCents: 3900, currencyCode: 'INR',
            currencySymbol: '₹', localPriceAmount: 3237,
            includedQuotas: [
              { quotaType: QuotaType.WhatsAppMessages, units: 500 },
              { quotaType: QuotaType.AiConversations, units: 500 },
              { quotaType: QuotaType.LeadCandidates, units: 50 },
            ],
          },
        ]),
      getSubscription: () => of(null),
      getPaymentHistory: () => of([payment('pay-1', 'CreditPack', 1660), payment('pay-2', 'CreditPack', 1660), payment('ref-1', 'Refund', -1162)]),
      getCapabilities: () => of({ refundRequestsEnabled: refundsEnabled }),
      getRefundRequests: () =>
        of(
          requests.map((r) => ({
            id: 'r', tenantId: 't', tenantName: 'Acme', paymentDescription: '1,000 AI conversations', reason: 'x',
            eligibleAmountCents: 1400, eligibleLocalAmount: 1162, currencyCode: 'INR', currencySymbol: '₹',
            refundedAmountCents: null, refundedLocalAmount: null, reviewNote: null, failureReason: null,
            createdAt: '2026-09-16T00:00:00Z', reviewedAtUtc: null, ...r,
          }))
        ),
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
  const buttons = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('.payment-row button')).filter((b) => text(b) === 'Request refund');

  it('lists what each plan includes per quota type', () => {
    const features = text(render(false).querySelector('.plan-features'));

    expect(features).toContain('500 whatsapp messages / month');
    expect(features).toContain('500 ai conversations / month');
    expect(features).toContain('50 lead candidates / month');
  });

  it('offers no refund button at all while the switch is off', () => {
    expect(buttons(render(false)).length).toBe(0);
  });

  it('offers it on real charges only, never on a refund row', () => {
    const root = render(true);
    const rows = Array.from(root.querySelectorAll('.payment-row'));

    expect(buttons(root).length).toBe(2);
    const refundRow = rows.find((r) => text(r).includes('Refund:'))!;
    expect(refundRow.querySelector('button')).toBeNull();
    expect(text(refundRow)).toContain('−₹1,162');
  });

  it('stops offering it once a request is waiting or already paid for that payment', () => {
    const root = render(true, [{ paymentId: 'pay-1', status: RefundStatus.Requested }]);

    expect(buttons(root).length).toBe(1);
    expect(text(root)).toContain('Waiting for review');
    expect(Array.from(root.querySelectorAll('.refund-row button')).map((b) => text(b))).toEqual(['Withdraw']);
  });

  it('offers it again after a request was declined', () => {
    const root = render(true, [{ paymentId: 'pay-1', status: RefundStatus.Rejected, reviewNote: 'Used it' }]);

    expect(buttons(root).length).toBe(2);
    expect(text(root)).toContain('Declined');
    expect(text(root)).toContain('Note: Used it');
  });
});

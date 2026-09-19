import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { RefundRequest, RefundStatus } from '../../../core/models/billing.model';
import { PlatformRefundService } from '../../../core/services/platform-refund.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformRefundListComponent } from './platform-refund-list.component';

const request = (status: RefundStatus, extra: Partial<RefundRequest> = {}): RefundRequest => ({
  id: `r-${status}`,
  tenantId: 't1',
  tenantName: 'Acme',
  paymentId: 'p1',
  paymentDescription: '1,000 AI conversations',
  status,
  reason: 'Bought too many',
  eligibleAmountCents: 1400,
  eligibleLocalAmount: 1162,
  currencyCode: 'INR',
  currencySymbol: '₹',
  refundedAmountCents: null,
  refundedLocalAmount: null,
  reviewNote: null,
  failureReason: null,
  createdAt: '2026-09-16T00:00:00Z',
  reviewedAtUtc: null,
  ...extra,
});

describe('PlatformRefundListComponent', () => {
  function render(items: RefundRequest[]) {
    const getPaged = jasmine.createSpy('getPaged').and.returnValue(of({ items, totalCount: items.length, page: 1, pageSize: 25, totalPages: 1 }));

    TestBed.configureTestingModule({
      declarations: [PlatformRefundListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: PlatformRefundService, useValue: { getPaged } }],
    });

    const fixture = TestBed.createComponent(PlatformRefundListComponent);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, getPaged };
  }

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('opens on what needs a decision - requests waiting for review', () => {
    const { getPaged } = render([request(RefundStatus.Requested)]);

    // RefundStatus.Requested is 0, so this also proves a falsy status still reaches the API.
    expect(getPaged.calls.mostRecent().args[0].status).toBe(RefundStatus.Requested);
  });

  it('offers approve and decline only where a person can still decide', () => {
    const { root } = render([
      request(RefundStatus.Requested),
      request(RefundStatus.Failed, { failureReason: 'gateway down' }),
      request(RefundStatus.Refunded, { refundedLocalAmount: 1162 }),
      request(RefundStatus.Rejected, { reviewNote: 'Used it' }),
    ]);

    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row'));
    const actions = rows.map((r) => Array.from(r.querySelectorAll('.actions button')).map((b) => text(b)));

    expect(actions).toEqual([['Approve', 'Decline'], ['Retry', 'Decline'], [], []]);
  });

  it('shows what was paid once refunded, and why one failed', () => {
    const { root } = render([
      request(RefundStatus.Refunded, { refundedLocalAmount: 581, refundedAmountCents: 700 }),
      request(RefundStatus.Failed, { failureReason: 'gateway down' }),
    ]);

    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row')).map((r) => text(r));
    expect(rows[0]).toContain('₹581.00');
    expect(rows[0]).toContain('Refunded');
    expect(rows[1]).toContain('Payout failed: gateway down');
  });
});

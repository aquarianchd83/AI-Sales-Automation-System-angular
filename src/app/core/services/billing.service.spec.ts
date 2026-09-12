import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BillingService } from './billing.service';
import { environment } from '../../../environments/environment';

describe('BillingService', () => {
  let service: BillingService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/billing`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(BillingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the plan catalog', () => {
    service.getPlans().subscribe((plans) => expect(plans).toEqual([]));
    http.expectOne({ url: `${baseUrl}/plans`, method: 'GET' }).flush([]);
  });

  it('gets the current subscription', () => {
    service.getSubscription().subscribe((subscription) => expect(subscription).toBeNull());
    http.expectOne({ url: `${baseUrl}/subscription`, method: 'GET' }).flush(null);
  });

  it('chooses (simulates paying for) a plan', () => {
    service.choosePlan('p1').subscribe();

    const request = http.expectOne(`${baseUrl}/plans/p1/choose`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      planId: 'p1',
      planName: 'Starter',
      status: 'Active',
      currentPeriodStartUtc: '2026-01-01T00:00:00Z',
      currentPeriodEndUtc: '2026-02-01T00:00:00Z',
    });
  });

  it('gets the payment history', () => {
    service.getPaymentHistory().subscribe((payments) => expect(payments).toEqual([]));
    http.expectOne({ url: `${baseUrl}/payments`, method: 'GET' }).flush([]);
  });
});

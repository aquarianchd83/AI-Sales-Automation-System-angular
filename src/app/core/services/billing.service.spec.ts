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

  it('starts a checkout session with the given plan and redirect urls', () => {
    service
      .createCheckoutSession({ planId: 'p1', successUrl: 'https://a', cancelUrl: 'https://b' })
      .subscribe();

    const request = http.expectOne(`${baseUrl}/checkout`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ planId: 'p1', successUrl: 'https://a', cancelUrl: 'https://b' });
    request.flush({ url: 'https://checkout.stripe.com/session' });
  });

  it('starts a billing portal session with the given return url', () => {
    service.createBillingPortalSession({ returnUrl: 'https://a' }).subscribe();

    const request = http.expectOne(`${baseUrl}/portal`);
    expect(request.request.body).toEqual({ returnUrl: 'https://a' });
    request.flush({ url: 'https://billing.stripe.com/session' });
  });
});

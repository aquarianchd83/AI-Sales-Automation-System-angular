import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { WalletRechargeService } from './wallet-recharge.service';

describe('WalletRechargeService', () => {
  let service: WalletRechargeService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/wallet`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(WalletRechargeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates an order with only the amount and currency - never a tenant id', () => {
    service.createOrder(500).subscribe();
    const req = http.expectOne(`${base}/recharge/create-order`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amount: 500, currency: 'INR' });
    req.flush({});
  });

  it('sends Razorpay\'s identifiers for server-side verification in Razorpay\'s own field names', () => {
    service.verifyPayment({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' }).subscribe();
    const req = http.expectOne(`${base}/recharge/verify-payment`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' });
    req.flush({});
  });

  it('reads status, history, balance, options and a quote from the wallet API', () => {
    service.getStatus('abc').subscribe();
    http.expectOne(`${base}/recharge/payment-status/abc`).flush({});

    service.getHistory({ page: 2, pageSize: 10 }).subscribe();
    const history = http.expectOne((r) => r.url === `${base}/recharge/history`);
    expect(history.request.params.get('Page')).toBe('2');
    expect(history.request.params.get('PageSize')).toBe('10');
    history.flush({ items: [], page: 2, pageSize: 10, totalCount: 0, totalPages: 0 });

    service.getBalance().subscribe();
    http.expectOne(`${base}/balance`).flush({ balance: 1, unit: 'credits' });

    service.getOptions().subscribe();
    http.expectOne(`${base}/recharge/options`).flush({});

    service.getQuote(250).subscribe();
    const quote = http.expectOne((r) => r.url === `${base}/recharge/quote`);
    expect(quote.request.params.get('amount')).toBe('250');
    quote.flush({});
  });
});

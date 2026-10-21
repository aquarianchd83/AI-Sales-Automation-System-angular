import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { QuotaType } from '../models/billing.model';
import { CreditPayer, CreditScenario, CreditUsageStatus } from '../models/credit-payer.model';
import { PlatformCreditPayerService } from './platform-credit-payer.service';

describe('PlatformCreditPayerService', () => {
  let service: PlatformCreditPayerService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/platform/credit-payers`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PlatformCreditPayerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the scenarios', () => {
    service.getScenarios().subscribe((scenarios) => expect(scenarios).toEqual([]));
    http.expectOne({ url: `${baseUrl}/scenarios`, method: 'GET' }).flush([]);
  });

  it('switches the payer for one scenario', () => {
    service.setPayer(CreditScenario.CustomerChatReply, { payer: CreditPayer.Platform }).subscribe();

    const request = http.expectOne(`${baseUrl}/scenarios/0`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ payer: CreditPayer.Platform });
    request.flush({});
  });

  it('tops up the platform wallet', () => {
    service.adjustWallet({ quotaType: QuotaType.AiConversations, unitsDelta: 50, reason: 'Launch' }).subscribe();

    const request = http.expectOne(`${baseUrl}/wallet/adjust`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ quotaType: QuotaType.AiConversations, unitsDelta: 50, reason: 'Launch' });
    request.flush([]);
  });

  it('filters the activity by scenario, payer, status and fallback', () => {
    service
      .getUsage({
        page: 2,
        pageSize: 10,
        search: 'acme',
        scenario: CreditScenario.ProductKnowledgeReading,
        chargedTo: CreditPayer.Tenant,
        status: CreditUsageStatus.Charged,
        fellBackToTenant: true,
      })
      .subscribe();

    const request = http.expectOne((r) => r.url === `${baseUrl}/usage`);
    expect(request.request.params.get('Page')).toBe('2');
    expect(request.request.params.get('PageSize')).toBe('10');
    expect(request.request.params.get('Search')).toBe('acme');
    expect(request.request.params.get('Scenario')).toBe('5');
    expect(request.request.params.get('ChargedTo')).toBe('0');
    expect(request.request.params.get('Status')).toBe('0');
    expect(request.request.params.get('FellBackToTenant')).toBe('true');
    request.flush({ items: [], totalCount: 0, page: 2, pageSize: 10, totalPages: 0 });
  });

  it('leaves unset filters out, including the ones whose value is zero-like', () => {
    service.getUsage({ scenario: null, chargedTo: CreditPayer.Tenant }).subscribe();

    const request = http.expectOne((r) => r.url === `${baseUrl}/usage`);
    expect(request.request.params.has('Scenario')).toBeFalse();
    expect(request.request.params.get('ChargedTo')).toBe('0');
    request.flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });
  });

  it('gives credits back to a tenant with a note', () => {
    service.redeem('u1', 'Charged by mistake').subscribe();

    const request = http.expectOne(`${baseUrl}/usage/u1/redeem`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ note: 'Charged by mistake' });
    request.flush({});
  });
});

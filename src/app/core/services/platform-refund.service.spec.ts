import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { QuotaEntryType } from '../models/billing.model';
import { PlatformRefundService } from './platform-refund.service';

describe('PlatformRefundService - a tenant\'s credit history', () => {
  let service: PlatformRefundService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PlatformRefundService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the chosen days, kind and feature with the entries request', () => {
    service
      .getTenantLedger('t1', { page: 2, pageSize: 10, from: '2026-10-01', to: '2026-10-24', entryType: QuotaEntryType.Purchase, feature: 'LeadDiscovery' })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/tenants/t1/quota/ledger'));
    expect(req.request.params.get('From')).toBe('2026-10-01');
    expect(req.request.params.get('To')).toBe('2026-10-24');
    expect(req.request.params.get('EntryType')).toBe('1');
    expect(req.request.params.get('Feature')).toBe('LeadDiscovery');
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 10 });
  });

  it('sends the chosen days with the summary request, for the tiles and the graph', () => {
    service.getTenantLedgerSummary('t1', 30, { from: '2026-10-01', to: '2026-10-24' }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/tenants/t1/quota/ledger/summary'));
    expect(req.request.params.get('from')).toBe('2026-10-01');
    expect(req.request.params.get('to')).toBe('2026-10-24');
    req.flush({ totalEntries: 0, byEntryType: [], byFeature: [], daily: [] });
  });

  it('sends no dates when none are chosen', () => {
    service.getTenantLedger('t1', { page: 1, pageSize: 10 }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/tenants/t1/quota/ledger'));
    expect(req.request.params.has('From')).toBeFalse();
    expect(req.request.params.has('To')).toBeFalse();
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 10 });
  });
});

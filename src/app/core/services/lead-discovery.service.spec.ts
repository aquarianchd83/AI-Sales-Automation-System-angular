import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { SaveLeadDiscoveryProfileRequest, addListEntries } from '../models/lead-discovery.model';
import { LeadDiscoveryService } from './lead-discovery.service';

describe('LeadDiscoveryService', () => {
  let service: LeadDiscoveryService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/lead-discovery`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(LeadDiscoveryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the profile', () => {
    service.getProfile().subscribe();
    http.expectOne({ url: `${baseUrl}/profile`, method: 'GET' }).flush({});
  });

  it('saves the whole profile with PUT', () => {
    const request: SaveLeadDiscoveryProfileRequest = {
      isEnabled: true,
      targetBusinessType: 'Eye clinic',
      keywords: ['eye clinic'],
      locations: ['Chandigarh'],
      batchSize: 25,
      requiredFields: ['City'],
      phoneRequired: true,
      emailRequired: false,
      independentBusiness: true,
      minimumLeadScore: 60,
      additionalCriteria: [],
      autoCampaignEnabled: false,
      sourceCampaignId: null,
    };
    service.saveProfile(request).subscribe();

    const req = http.expectOne(`${baseUrl}/profile`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('pages leads with PascalCase paging params and a camelCase minScore', () => {
    service.getLeads({ page: 2, pageSize: 25, search: 'clinic' }, 70).subscribe();

    const req = http.expectOne((r) => r.url === `${baseUrl}/leads`);
    expect(req.request.params.get('Page')).toBe('2');
    expect(req.request.params.get('PageSize')).toBe('25');
    expect(req.request.params.get('Search')).toBe('clinic');
    expect(req.request.params.get('minScore')).toBe('70');
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 25, totalPages: 0 });
  });

  it('omits minScore when no filter is chosen', () => {
    service.getLeads({ page: 1 }, null).subscribe();
    const req = http.expectOne((r) => r.url === `${baseUrl}/leads`);
    expect(req.request.params.has('minScore')).toBeFalse();
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });
  });

  it('pages history with PascalCase paging plus From/To/Status', () => {
    service.getHistory({ page: 1, pageSize: 25, from: '2026-09-01', to: '2026-09-30', status: 'RetryPending' }).subscribe();

    const req = http.expectOne((r) => r.url === `${baseUrl}/history`);
    expect(req.request.params.get('Page')).toBe('1');
    expect(req.request.params.get('From')).toBe('2026-09-01');
    expect(req.request.params.get('To')).toBe('2026-09-30');
    expect(req.request.params.get('Status')).toBe('RetryPending');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });
  });

  it('omits From/To/Status when unset', () => {
    service.getHistory({ page: 1, pageSize: 25 }).subscribe();
    const req = http.expectOne((r) => r.url === `${baseUrl}/history`);
    expect(req.request.params.has('From')).toBeFalse();
    expect(req.request.params.has('To')).toBeFalse();
    expect(req.request.params.has('Status')).toBeFalse();
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });
  });

  it('gets one execution by id', () => {
    service.getExecution('exec-1').subscribe();
    http.expectOne({ url: `${baseUrl}/executions/exec-1`, method: 'GET' }).flush({});
  });

  it('posts a retry for one execution', () => {
    service.retryExecution('exec-1').subscribe();
    const req = http.expectOne({ url: `${baseUrl}/executions/exec-1/retry`, method: 'POST' });
    expect(req.request.body).toEqual({});
    req.flush({ executionId: 'exec-1', backgroundJobId: 'job-1' });
  });
});

describe('addListEntries', () => {
  const opts = { maxLength: 10, maxCount: 3, noun: 'keyword', separator: ',' };

  it('splits, trims, collapses spaces and skips case-insensitive duplicates', () => {
    expect(addListEntries(['Solar'], ' solar , roof   top,,', opts)).toEqual({
      values: ['Solar', 'roof top'],
      error: null,
    });
  });

  it('keeps commas when no separator is given', () => {
    expect(addListEntries([], 'Andheri, Mumbai', { maxLength: 50, maxCount: 3, noun: 'location' }).values).toEqual([
      'Andheri, Mumbai',
    ]);
  });

  it('reports entries that are too long or past the limit', () => {
    expect(addListEntries([], 'much-too-long-entry', opts).error).toContain('at most 10 characters');
    expect(addListEntries(['a', 'b', 'c'], 'd', opts)).toEqual({
      values: ['a', 'b', 'c'],
      error: 'You can add up to 3 keywords.',
    });
  });
});

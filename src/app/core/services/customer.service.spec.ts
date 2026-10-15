import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CustomerService } from './customer.service';
import { environment } from '../../../environments/environment';

describe('CustomerService', () => {
  let service: CustomerService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/customers`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CustomerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the PascalCase paging parameters the API binds', () => {
    service.getPaged({ page: 2, pageSize: 25, search: 'ada' }).subscribe();

    const request = http.expectOne((req) => req.url === baseUrl);
    expect(request.request.params.get('Page')).toBe('2');
    expect(request.request.params.get('PageSize')).toBe('25');
    expect(request.request.params.get('Search')).toBe('ada');
    request.flush({ items: [], page: 2, pageSize: 25, totalCount: 0, totalPages: 0 });
  });

  it('omits an empty search rather than sending a blank parameter', () => {
    service.getPaged({ page: 1, pageSize: 25, search: '' }).subscribe();

    const request = http.expectOne((req) => req.url === baseUrl);
    expect(request.request.params.has('Search')).toBeFalse();
    request.flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
  });

  it('posts the import as multipart form data under the field name "file"', () => {
    const file = new File(['PhoneNumber\n+15551234567'], 'customers.csv', {
      type: 'text/csv',
    });

    service.import(file).subscribe();

    const request = http.expectOne(`${baseUrl}/import`);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect(body.get('file')).toBeTruthy();
    expect(request.request.reportProgress).toBeTrue();
    request.flush({
      totalRows: 1,
      importedCount: 1,
      skippedDuplicateCount: 0,
      failedCount: 0,
      rowErrors: [],
    });
  });

  it('GETs the processing history of one customer', () => {
    let result: unknown;
    service.getHistory('c1').subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/c1/history`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'e1', eventType: 'Discovered' }]);
    expect(result).toEqual([{ id: 'e1', eventType: 'Discovered' }]);
  });

  it('reads the consent setting', () => {
    let result: unknown;
    service.getConsentSetting().subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/consent-setting`);
    expect(req.request.method).toBe('GET');
    req.flush({ consentRequired: false });
    expect(result).toEqual({ consentRequired: false });
  });

  it('PUTs the consent setting', () => {
    service.setConsentSetting(true).subscribe();

    const req = http.expectOne(`${baseUrl}/consent-setting`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ consentRequired: true });
    req.flush({ consentRequired: true });
  });

  it('sends tags as tagNames', () => {
    service.addTags('customer-1', ['vip', 'newsletter']).subscribe();

    const request = http.expectOne(`${baseUrl}/customer-1/tags`);
    expect(request.request.body).toEqual({ tagNames: ['vip', 'newsletter'] });
    request.flush({});
  });

  it('DELETEs a URL-encoded tag name to remove it', () => {
    service.removeTag('customer-1', 'VIP Customer').subscribe();

    const request = http.expectOne(`${baseUrl}/customer-1/tags/VIP%20Customer`);
    expect(request.request.method).toBe('DELETE');
    request.flush({});
  });

  it('posts all ids to bulk-delete in one request', () => {
    let result: { deletedCount: number } | undefined;
    service.bulkDelete(['id-1', 'id-2', 'id-3']).subscribe((r) => (result = r));

    const request = http.expectOne(`${baseUrl}/bulk-delete`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ ids: ['id-1', 'id-2', 'id-3'] });

    request.flush({ requestedCount: 3, deletedCount: 2, notFoundIds: ['id-3'] });
    expect(result?.deletedCount).toBe(2);
  });

  it('posts the consent source, proof and scope on opt-in', () => {
    const body = { source: 'WebsiteForm', proof: 'form-1042', scope: 'Marketing' as const };
    service.optIn('customer-1', body).subscribe();

    const request = http.expectOne(`${baseUrl}/customer-1/opt-in`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({});
  });

  it('posts opt-out without a request body', () => {
    service.optOut('customer-1').subscribe();

    const request = http.expectOne(`${baseUrl}/customer-1/opt-out`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({});
  });
});

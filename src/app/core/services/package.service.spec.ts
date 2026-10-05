import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PackageService } from './package.service';
import { SavePackageRequest } from '../models/package.model';
import { environment } from '../../../environments/environment';

describe('PackageService', () => {
  let service: PackageService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/packages`;

  const request: SavePackageRequest = {
    name: 'Gold',
    description: null,
    price: 5000,
    durationValue: 3,
    durationUnit: 'Months',
    features: ['SEO'],
    expectedSales: 4,
    isActive: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PackageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the PascalCase paging parameters', () => {
    service.getPaged({ page: 2, pageSize: 10, search: 'gold' }).subscribe();

    const req = http.expectOne((r) => r.url === baseUrl);
    expect(req.request.params.get('Page')).toBe('2');
    expect(req.request.params.get('Search')).toBe('gold');
    req.flush({ items: [], page: 2, pageSize: 10, totalCount: 0, totalPages: 0 });
  });

  it('reads the summary from /packages/summary', () => {
    let total = -1;
    service.getSummary().subscribe((summary) => (total = summary.totalProjectedRevenue));
    http.expectOne(`${baseUrl}/summary`).flush({ activePackages: 2, totalExpectedSales: 14, totalProjectedRevenue: 40000 });
    expect(total).toBe(40000);
  });

  it('POSTs a create and PUTs an update to the package id', () => {
    service.create(request).subscribe();
    const post = http.expectOne(baseUrl);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(request);
    post.flush({});

    service.update('p-1', request).subscribe();
    const put = http.expectOne(`${baseUrl}/p-1`);
    expect(put.request.method).toBe('PUT');
    put.flush({});
  });

  it('DELETEs by id', () => {
    service.delete('p-1').subscribe();
    const req = http.expectOne(`${baseUrl}/p-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('records, lists and removes sales under /packages/sales', () => {
    service.recordSale({ packageId: 'p-1', customerId: null, amount: 4500, soldAt: null }).subscribe();
    const post = http.expectOne(`${baseUrl}/sales`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.amount).toBe(4500);
    post.flush({});

    service.getSales({ page: 1, pageSize: 8 }).subscribe();
    const get = http.expectOne((r) => r.url === `${baseUrl}/sales`);
    expect(get.request.params.get('PageSize')).toBe('8');
    get.flush({ items: [], page: 1, pageSize: 8, totalCount: 0, totalPages: 0 });

    service.deleteSale('s-1').subscribe();
    const del = http.expectOne(`${baseUrl}/sales/s-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});

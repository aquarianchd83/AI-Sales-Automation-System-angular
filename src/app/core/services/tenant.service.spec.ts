import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TenantService } from './tenant.service';
import { environment } from '../../../environments/environment';

describe('TenantService', () => {
  let service: TenantService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/tenants`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TenantService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('looks a tenant up by slug', () => {
    service.getBySlug('acme-corp').subscribe();

    const request = http.expectOne(`${baseUrl}/by-slug/acme-corp`);
    expect(request.request.method).toBe('GET');
    request.flush({ name: 'Acme Corp', slug: 'acme-corp' });
  });
});

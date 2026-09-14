import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PlatformLogService } from './platform-log.service';
import { environment } from '../../../environments/environment';

describe('PlatformLogService', () => {
  let service: PlatformLogService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/logs`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PlatformLogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends each selected level as a repeated Level param', () => {
    service.getPaged({ page: 1, levels: ['Error', 'Warning'], tenantId: 't1' }).subscribe();

    const req = http.expectOne((r) => r.url === baseUrl);
    expect(req.request.params.getAll('Level')).toEqual(['Error', 'Warning']);
    expect(req.request.params.get('TenantId')).toBe('t1');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });
  });

  it('omits Level when no level is selected', () => {
    service.getPaged({ page: 1, levels: [] }).subscribe();

    const req = http.expectOne((r) => r.url === baseUrl);
    expect(req.request.params.has('Level')).toBeFalse();
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });
  });
});

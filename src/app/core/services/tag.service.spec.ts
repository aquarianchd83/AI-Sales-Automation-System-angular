import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TagService } from './tag.service';
import { environment } from '../../../environments/environment';

describe('TagService', () => {
  let service: TagService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/tags`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TagService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the PascalCase paging parameters', () => {
    service.getPaged({ page: 1, pageSize: 25, search: 'vip' }).subscribe();

    const request = http.expectOne((req) => req.url === baseUrl);
    expect(request.request.params.get('Page')).toBe('1');
    expect(request.request.params.get('Search')).toBe('vip');
    request.flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
  });

  it('defaults delete to force=false', () => {
    service.delete('tag-1').subscribe();

    const request = http.expectOne((req) => req.url === `${baseUrl}/tag-1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('force')).toBe('false');
    request.flush(null);
  });

  it('sends force=true when asked to force-delete', () => {
    service.delete('tag-1', true).subscribe();

    const request = http.expectOne((req) => req.url === `${baseUrl}/tag-1`);
    expect(request.request.params.get('force')).toBe('true');
    request.flush(null);
  });

  it('sends the name on create and update', () => {
    service.create({ name: 'VIP' }).subscribe();
    http.expectOne(baseUrl).flush({ id: '1', name: 'VIP', customerCount: 0, createdAt: '' });

    service.update('tag-1', { name: 'VIP Customers' }).subscribe();
    const putRequest = http.expectOne(`${baseUrl}/tag-1`);
    expect(putRequest.request.body).toEqual({ name: 'VIP Customers' });
    putRequest.flush({ id: 'tag-1', name: 'VIP Customers', customerCount: 3, createdAt: '' });
  });
});

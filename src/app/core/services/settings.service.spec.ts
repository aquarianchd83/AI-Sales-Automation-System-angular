import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SettingsService } from './settings.service';
import { environment } from '../../../environments/environment';

describe('SettingsService', () => {
  let service: SettingsService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/settings`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(SettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches all categories', () => {
    service.getAll().subscribe();

    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('fetches a single category', () => {
    service.getCategory('WhatsApp').subscribe();

    const request = http.expectOne(`${baseUrl}/WhatsApp`);
    expect(request.request.method).toBe('GET');
    request.flush({ category: 'WhatsApp', items: [] });
  });

  it('sends only the changed values on update', () => {
    service.update('WhatsApp', { ApiKey: 'new-key' }).subscribe();

    const request = http.expectOne(`${baseUrl}/WhatsApp`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ values: { ApiKey: 'new-key' } });
    request.flush(null);
  });

  it('posts to reload with no body payload the API cares about', () => {
    service.reload().subscribe();

    const request = http.expectOne(`${baseUrl}/reload`);
    expect(request.request.method).toBe('POST');
    request.flush(null);
  });
});

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ConsentPageService } from './consent-page.service';

describe('ConsentPageService', () => {
  let service: ConsentPageService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/consent-page-settings`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ConsentPageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads, saves, previews and publishes the signed-in tenant\'s own page - no tenant id is ever sent', () => {
    service.get().subscribe();
    http.expectOne({ url: baseUrl, method: 'GET' }).flush(null);

    const body = {
      businessName: 'Acme',
      productDescription: 'Eye tests.',
      additionalInfo: null,
      consentStatement: null,
      privacyPolicyUrl: null,
      termsUrl: null,
    };
    service.save(body).subscribe();
    const save = http.expectOne({ url: baseUrl, method: 'PUT' });
    expect(save.request.body).toEqual(body);
    expect(Object.keys(save.request.body)).not.toContain('tenantId');
    save.flush(null);

    service.preview().subscribe();
    http.expectOne({ url: `${baseUrl}/preview`, method: 'GET' }).flush(null);

    service.publish().subscribe();
    http.expectOne({ url: `${baseUrl}/publish`, method: 'POST' }).flush(null);
  });

  it('switches the page on and off', () => {
    service.setActive(false).subscribe();
    http.expectOne({ url: `${baseUrl}/deactivate`, method: 'POST' }).flush(null);

    service.setActive(true).subscribe();
    http.expectOne({ url: `${baseUrl}/activate`, method: 'POST' }).flush(null);
  });
});

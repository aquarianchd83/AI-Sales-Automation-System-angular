import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MessageTemplateService } from './message-template.service';
import { environment } from '../../../environments/environment';

describe('MessageTemplateService', () => {
  let service: MessageTemplateService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/message-templates`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(MessageTemplateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends only bodyText and isActive on update', () => {
    service.update('t1', { bodyText: 'Hi {{FirstName}}', isActive: true }).subscribe();

    const req = http.expectOne(`${baseUrl}/t1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ bodyText: 'Hi {{FirstName}}', isActive: true });
    req.flush({});
  });

  it('posts the new status to review', () => {
    service.review('t1', { status: 'Approved' }).subscribe();

    const req = http.expectOne(`${baseUrl}/t1/review`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ status: 'Approved' });
    req.flush({});
  });
});

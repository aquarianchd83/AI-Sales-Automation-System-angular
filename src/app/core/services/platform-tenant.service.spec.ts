import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PlatformTenantService } from './platform-tenant.service';

describe('PlatformTenantService notification email', () => {
  let service: PlatformTenantService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PlatformTenantService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the trimmed address for the tenant', () => {
    service.updateNotificationEmail('t1', '  alerts@acme.test ').subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/platform/tenants/t1/notification-email'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ email: 'alerts@acme.test' });
    req.flush({ billingAlertEmail: 'alerts@acme.test', ownerEmail: 'owner@acme.test' });
  });

  it('sends null when the box is emptied, so notices go to the owner again', () => {
    service.updateNotificationEmail('t1', '   ').subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/platform/tenants/t1/notification-email'));
    expect(req.request.body).toEqual({ email: null });
    req.flush({ billingAlertEmail: null, ownerEmail: 'owner@acme.test' });
  });
});

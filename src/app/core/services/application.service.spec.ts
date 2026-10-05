import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApplicationService } from './application.service';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/applications`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ApplicationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the plans an application can start on', () => {
    service.getPlans().subscribe();
    http.expectOne(`${baseUrl}/plans`).flush([]);
  });

  it('creates an application on a plan, sending no name when none was typed', () => {
    service.create('plan-1', '').subscribe();

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ planId: 'plan-1', name: null });
    req.flush({});
  });

  it('reads the wizard payload from /setup', () => {
    service.getSetup('app-1').subscribe();
    const req = http.expectOne(`${baseUrl}/app-1/setup`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('saves partial answers with PUT /setup, carrying the complete flag and reason', () => {
    service.saveSetup('app-1', { values: { brand_name: 'ABC', website: null }, complete: true, reason: 'Rebrand' }).subscribe();

    const req = http.expectOne(`${baseUrl}/app-1/setup`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ values: { brand_name: 'ABC', website: null }, complete: true, reason: 'Rebrand' });
    req.flush({});
  });

  it('changes plan, migrates and executes with POST', () => {
    service.changePlan('app-1', 'plan-2', 'Growing').subscribe();
    const change = http.expectOne(`${baseUrl}/app-1/change-plan`);
    expect(change.request.body).toEqual({ planId: 'plan-2', reason: 'Growing' });
    change.flush({});

    service.migrate('app-1').subscribe();
    http.expectOne(`${baseUrl}/app-1/migrate`).flush({});

    service.execute('app-1').subscribe();
    const run = http.expectOne(`${baseUrl}/app-1/execute`);
    expect(run.request.method).toBe('POST');
    run.flush({});
  });

  it('pages the setup history with the API\'s PascalCase parameters', () => {
    service.getAudit('app-1', 2, 10).subscribe();

    const req = http.expectOne((r) => r.url === `${baseUrl}/app-1/audit`);
    expect(req.request.params.get('Page')).toBe('2');
    expect(req.request.params.get('PageSize')).toBe('10');
    req.flush({ items: [], page: 2, pageSize: 10, totalCount: 0, totalPages: 0 });
  });
});

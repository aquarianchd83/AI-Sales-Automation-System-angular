import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { SaveRequirementRequest } from '../models/application-setup.model';
import { PlatformSetupService } from './platform-setup.service';

describe('PlatformSetupService', () => {
  let service: PlatformSetupService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/platform/setup`;

  const requirement: SaveRequirementRequest = {
    fieldKey: 'contact_phone',
    label: 'Contact phone',
    helpText: null,
    fieldType: 'Phone',
    isRequired: false,
    defaultValue: null,
    options: null,
    validation: null,
    displayOrder: 25,
    section: 'communication',
    condition: null,
    metricKey: null,
    isActive: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PlatformSetupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts a draft version, optionally cloned from a given one', () => {
    service.createVersion('plan-1', 'Ask for a phone', 'v1-id').subscribe();

    const req = http.expectOne(`${baseUrl}/plans/plan-1/versions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ cloneFromVersionId: 'v1-id', releaseNotes: 'Ask for a phone' });
    req.flush({});
  });

  it('adds, edits and removes requirements', () => {
    service.addRequirement('v-1', requirement).subscribe();
    const add = http.expectOne(`${baseUrl}/versions/v-1/requirements`);
    expect(add.request.method).toBe('POST');
    add.flush({});

    service.updateRequirement('r-1', requirement).subscribe();
    const update = http.expectOne(`${baseUrl}/requirements/r-1`);
    expect(update.request.method).toBe('PUT');
    update.flush({});

    service.deleteRequirement('r-1').subscribe();
    const del = http.expectOne(`${baseUrl}/requirements/r-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('previews, publishes and discards a version', () => {
    service.preview('v-1').subscribe();
    http.expectOne(`${baseUrl}/versions/v-1/preview`).flush({});

    service.publish('v-1').subscribe();
    const publish = http.expectOne(`${baseUrl}/versions/v-1/publish`);
    expect(publish.request.method).toBe('POST');
    publish.flush({});

    service.deleteVersion('v-1').subscribe();
    http.expectOne(`${baseUrl}/versions/v-1`).flush(null);
  });
});

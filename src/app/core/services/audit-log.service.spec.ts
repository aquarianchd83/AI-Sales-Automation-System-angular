import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { formatChanges } from '../models/audit-log.model';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AuditLogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('binds the PascalCase names the API expects and omits empty filters', () => {
    service
      .getPaged({ page: 2, pageSize: 10, entityName: 'Lead', action: 'Updated', from: '2026-09-01T00:00:00.000Z' })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/audit-logs'));
    expect(req.request.params.get('Page')).toBe('2');
    expect(req.request.params.get('PageSize')).toBe('10');
    expect(req.request.params.get('EntityName')).toBe('Lead');
    expect(req.request.params.get('Action')).toBe('Updated');
    expect(req.request.params.get('From')).toBe('2026-09-01T00:00:00.000Z');
    expect(req.request.params.has('To')).toBeFalse();
    expect(req.request.params.has('Search')).toBeFalse();
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 10, totalPages: 0 });
  });

  it('pretty-prints changes and passes invalid JSON through untouched', () => {
    expect(formatChanges('{"stage":"Won"}')).toBe('{\n  "stage": "Won"\n}');
    expect(formatChanges('not json')).toBe('not json');
    expect(formatChanges(null)).toBe('');
  });
});

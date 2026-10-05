import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LeadFollowUpService } from './lead-follow-up.service';
import { environment } from '../../../environments/environment';

describe('LeadFollowUpService', () => {
  let service: LeadFollowUpService;
  let http: HttpTestingController;
  const followUpsUrl = `${environment.apiBaseUrl}/lead-follow-ups`;
  const leadsUrl = `${environment.apiBaseUrl}/leads`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(LeadFollowUpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists with PascalCase paging plus the status and due-within filters', () => {
    service.getPaged({ page: 2, pageSize: 10, search: 'asha' }, 'Sent', 30).subscribe();

    const request = http.expectOne((req) => req.url === followUpsUrl);
    expect(request.request.params.get('Page')).toBe('2');
    expect(request.request.params.get('Search')).toBe('asha');
    expect(request.request.params.get('status')).toBe('Sent');
    expect(request.request.params.get('dueWithinDays')).toBe('30');
    request.flush({ items: [], page: 2, pageSize: 10, totalCount: 0, totalPages: 0 });
  });

  it('sends no filter parameters when none are chosen, and keeps a due-within of zero', () => {
    service.getPaged({ page: 1, pageSize: 25 }).subscribe();
    const none = http.expectOne((req) => req.url === followUpsUrl);
    expect(none.request.params.has('status')).toBeFalse();
    expect(none.request.params.has('dueWithinDays')).toBeFalse();
    none.flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });

    service.getPaged({ page: 1, pageSize: 25 }, undefined, 0).subscribe();
    const zero = http.expectOne((req) => req.url === followUpsUrl);
    expect(zero.request.params.get('dueWithinDays')).toBe('0');
    zero.flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
  });

  it('schedules against the lead', () => {
    const body = { months: 2, dueAt: null, messageTemplateId: 't-1', reason: 'Budget' };
    service.schedule('lead-1', body).subscribe();

    const request = http.expectOne(`${leadsUrl}/lead-1/follow-ups`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({});
  });

  it('cancels, sends now, and reads the summary and a lead history', () => {
    service.cancel('f-1').subscribe();
    const cancel = http.expectOne(`${followUpsUrl}/f-1/cancel`);
    expect(cancel.request.method).toBe('POST');
    cancel.flush({});

    service.sendNow('f-1').subscribe();
    http.expectOne(`${followUpsUrl}/f-1/send-now`).flush({});

    service.getSummary().subscribe();
    http.expectOne(`${followUpsUrl}/summary`).flush({ scheduled: 0, dueNow: 0, dueWithin30Days: 0, sent: 0 });

    service.getForLead('lead-1').subscribe();
    http.expectOne(`${leadsUrl}/lead-1/follow-ups`).flush([]);
  });
});

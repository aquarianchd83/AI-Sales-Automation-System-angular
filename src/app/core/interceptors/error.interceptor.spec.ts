import { HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from '../services/analytics.service';
import { NotificationService } from '../services/notification.service';
import { ErrorInterceptor } from './error.interceptor';

describe('ErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notify = jasmine.createSpyObj('NotificationService', ['error']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        { provide: NotificationService, useValue: notify },
        { provide: AnalyticsService, useValue: { trackApiError: () => undefined } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  const fail = (status: number, body: object) => {
    http.get('/x').subscribe({ error: () => undefined });
    backend.expectOne('/x').flush(body, { status, statusText: 'err' });
  };

  it('shows a toast for an ordinary failure', () => {
    fail(500, { title: 'Something broke' });

    expect(notify.error).toHaveBeenCalledWith('Something broke');
  });

  it('stays quiet when a feature is outside the plan - the dashboard badge says so', () => {
    fail(403, { title: 'Content Studio is not part of your plan. Upgrade to Premium to use it.' });

    expect(notify.error).not.toHaveBeenCalled();
  });

  it('still shows other refusals', () => {
    fail(403, { title: 'You do not have permission to do that.' });

    expect(notify.error).toHaveBeenCalledTimes(1);
  });
});

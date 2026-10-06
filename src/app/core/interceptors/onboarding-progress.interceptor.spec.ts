import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OnboardingService } from '../services/onboarding.service';
import { OnboardingProgressInterceptor } from './onboarding-progress.interceptor';

describe('OnboardingProgressInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let onboarding: jasmine.SpyObj<OnboardingService>;

  beforeEach(() => {
    onboarding = jasmine.createSpyObj<OnboardingService>('OnboardingService', ['noteChange']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: OnboardingService, useValue: onboarding },
        { provide: HTTP_INTERCEPTORS, useClass: OnboardingProgressInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('reports a successful save', () => {
    http.post('/api/v1/packages', {}).subscribe();
    backend.expectOne('/api/v1/packages').flush({});

    expect(onboarding.noteChange).toHaveBeenCalledTimes(1);
  });

  it('ignores reads, failures, sign-in traffic and onboarding itself', () => {
    http.get('/api/v1/packages').subscribe();
    backend.expectOne('/api/v1/packages').flush([]);
    http.put('/api/v1/tenant-settings/whatsapp', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/tenant-settings/whatsapp').flush({}, { status: 400, statusText: 'Bad Request' });
    http.post('/api/v1/auth/refresh', {}).subscribe();
    backend.expectOne('/api/v1/auth/refresh').flush({});
    http.post('/api/v1/onboarding', {}).subscribe();
    backend.expectOne('/api/v1/onboarding').flush({});

    expect(onboarding.noteChange).not.toHaveBeenCalled();
  });
});

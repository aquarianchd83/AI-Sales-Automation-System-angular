import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { OnboardingStatus } from '../models/onboarding.model';
import { AuthService } from './auth.service';
import { OnboardingService } from './onboarding.service';

const status = (isCompleted: boolean): OnboardingStatus => ({
  isCompleted,
  progressPercent: isCompleted ? 100 : 20,
  currentStepKey: isCompleted ? null : 'customer-package',
  completedAt: null,
  steps: [],
});

describe('OnboardingService', () => {
  let service: OnboardingService;
  let backend: HttpTestingController;
  const url = `${environment.apiBaseUrl}/onboarding`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: AuthService, useValue: { currentUser: { id: 'u1' } } }],
    });
    service = TestBed.inject(OnboardingService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('serves a completed status from the cache for navigation', () => {
    service.refresh().subscribe();
    backend.expectOne(url).flush(status(true));

    let served: OnboardingStatus | null = null;
    service.current().subscribe((s) => (served = s));

    backend.expectNone(url);
    expect(served!.isCompleted).toBeTrue();
  });

  it('re-reads after a save or delete even when setup was complete, so an undone step is noticed', fakeAsync(() => {
    service.refresh().subscribe();
    backend.expectOne(url).flush(status(true));
    const seen: boolean[] = [];
    service.status$.subscribe((s) => s && seen.push(s.isCompleted));

    service.noteChange();
    service.noteChange(); // a burst is one read
    tick(700);
    backend.expectOne(url).flush(status(false));

    expect(seen).toEqual([true, false]);
  }));

  it('does nothing before the first status has been read', fakeAsync(() => {
    service.noteChange();
    tick(700);

    backend.expectNone(url);
  }));
});

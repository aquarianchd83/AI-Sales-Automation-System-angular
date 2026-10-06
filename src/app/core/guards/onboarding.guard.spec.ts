import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, firstValueFrom, isObservable, of, throwError } from 'rxjs';

import { OnboardingStatus, OnboardingStep, OnboardingStepState } from '../models/onboarding.model';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';
import { onboardingGuard } from './onboarding.guard';

const ROUTES = ['/profile', '/billing', '/packages', '/lead-discovery/profile', '/tenant-settings', '/message-templates', '/customers', '/campaigns', '/knowledge-base'];

/** A status whose first `completed` steps are done; the next is current, the rest locked. */
function status(completed: number): OnboardingStatus {
  const steps: OnboardingStep[] = ROUTES.map((route, i) => ({
    key: `step-${i}`,
    title: `Step ${i + 1}`,
    description: '',
    weight: i === 2 || i === 4 ? 15 : 10,
    route,
    state: (i < completed ? 'Completed' : i === completed ? 'Current' : 'Pending') as OnboardingStepState,
    completedAt: null,
    missing: null,
  }));
  const done = completed >= steps.length;
  return {
    isCompleted: done,
    progressPercent: steps.filter((s) => s.state === 'Completed').reduce((sum, s) => sum + s.weight, 0),
    currentStepKey: done ? null : `step-${completed}`,
    completedAt: null,
    steps,
  };
}

describe('onboardingGuard', () => {
  let auth: { isAuthenticated: boolean; isImpersonating: boolean; roles: string[]; hasAnyRole: (r: string[]) => boolean };
  let onboarding: jasmine.SpyObj<OnboardingService>;
  let router: Router;

  async function visit(url: string): Promise<true | string> {
    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)
    ) as boolean | UrlTree | Observable<boolean | UrlTree>;
    const value = isObservable(result) ? await firstValueFrom(result) : result;
    return value === true ? true : router.serializeUrl(value as UrlTree);
  }

  beforeEach(() => {
    auth = {
      isAuthenticated: true,
      isImpersonating: false,
      roles: ['Admin'],
      hasAnyRole(roles: string[]) {
        return roles.length === 0 || roles.some((r) => this.roles.includes(r));
      },
    };
    onboarding = jasmine.createSpyObj<OnboardingService>('OnboardingService', ['current']);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OnboardingService, useValue: onboarding },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('AC01: sends a tenant with incomplete onboarding from the dashboard to the wizard', async () => {
    onboarding.current.and.returnValue(of(status(0)));

    expect(await visit('/dashboard')).toBe('/onboarding');
    expect(await visit('/')).toBe('/onboarding');
  });

  it("lets the Admin use the current step's screen and the completed ones, but not one that is waiting", async () => {
    onboarding.current.and.returnValue(of(status(4))); // steps 1-4 done, WhatsApp current

    expect(await visit('/profile')).toBeTrue();
    expect(await visit('/lead-discovery/profile')).toBeTrue();
    expect(await visit('/tenant-settings')).toBeTrue();
    expect(await visit('/tenant-settings?tab=1')).toBeTrue();
    expect(await visit('/campaigns')).toBe('/onboarding');
    expect(await visit('/lead-discovery')).toBe('/onboarding'); // the step is the profile, not the whole module
  });

  it('opens a step that has its data even when it comes after the one still to do', async () => {
    const gap = status(2); // package step to do; the rest waiting - then give the later steps their data
    gap.steps.forEach((step, n) => {
      if (n > 2) {
        step.state = 'Completed';
      }
    });
    onboarding.current.and.returnValue(of(gap));

    expect(await visit('/customers')).toBeTrue();
    expect(await visit('/campaigns')).toBeTrue();
    expect(await visit('/packages')).toBeTrue();
  });

  it('keeps every other tenant user on the waiting screen', async () => {
    auth.roles = ['SalesAgent'];
    onboarding.current.and.returnValue(of(status(4)));

    expect(await visit('/tenant-settings')).toBe('/onboarding');
    expect(await visit('/onboarding')).toBeTrue();
  });

  it('always allows the wizard and the user\'s own account', async () => {
    onboarding.current.and.returnValue(of(status(0)));

    expect(await visit('/onboarding')).toBeTrue();
    expect(await visit('/account/change-password')).toBeTrue();
  });

  it('AC12: opens everything once onboarding is complete', async () => {
    onboarding.current.and.returnValue(of(status(9)));

    expect(await visit('/campaigns')).toBeTrue();
    expect(await visit('/dashboard')).toBeTrue();
  });

  it('never holds a platform operator or a support session', async () => {
    onboarding.current.and.returnValue(of(status(0)));

    auth.roles = ['PlatformSuperAdmin'];
    expect(await visit('/platform')).toBeTrue();

    auth.roles = ['Admin'];
    auth.isImpersonating = true;
    expect(await visit('/campaigns')).toBeTrue();
    expect(onboarding.current).not.toHaveBeenCalled();
  });

  it('lets the user through rather than locking them out when the status cannot be read', async () => {
    onboarding.current.and.returnValue(throwError(() => new Error('offline')));

    expect(await visit('/dashboard')).toBeTrue();
  });
});

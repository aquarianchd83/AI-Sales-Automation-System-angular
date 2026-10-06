import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, NEVER, of } from 'rxjs';

import { OnboardingStatus, OnboardingStepState } from '../../core/models/onboarding.model';
import { AccountRecoveryService } from '../../core/services/account-recovery.service';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { NotificationHubService } from '../../core/services/notification-hub.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './shell.component';

const TITLES = ['Profile Information', 'Select Package Plan', 'Create Customer Package', 'Lead Discovery Profile', 'WhatsApp Configuration'];

function status(completed: number, done = false): OnboardingStatus {
  const steps = TITLES.map((title, i) => ({
    key: `s${i}`,
    title,
    description: '',
    weight: 20,
    route: `/r${i}`,
    state: (done || i < completed ? 'Completed' : i === completed ? 'Current' : 'Pending') as OnboardingStepState,
    completedAt: null,
    missing: null,
  }));
  return { isCompleted: done, progressPercent: done ? 100 : completed * 20, currentStepKey: done ? null : `s${completed}`, completedAt: null, steps };
}

describe('ShellComponent during onboarding', () => {
  let status$: BehaviorSubject<OnboardingStatus | null>;
  let refresh: jasmine.Spy;

  function render(roles = ['Admin'], url = '/r2') {
    const auth = {
      currentUser$: of({ fullName: 'Test User', email: 't@example.com', roles, emailConfirmed: true }),
      isImpersonating: false,
      hasAnyRole: (wanted: string[]) => wanted.length === 0 || wanted.some((r) => roles.includes(r)),
    };
    refresh = jasmine.createSpy('refresh');

    TestBed.configureTestingModule({
      declarations: [ShellComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OnboardingService, useValue: { status$: status$.asObservable(), refresh } },
        { provide: AnnouncementService, useValue: { getActive: () => of([]) } },
        { provide: AccountRecoveryService, useValue: { resendVerificationEmail: () => of(undefined) } },
        { provide: AccountService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: BillingService, useValue: { getNotifications: () => of([]) } },
        { provide: TenantProfileService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: PlatformNotificationService, useValue: { getRecent: () => of([]) } },
        { provide: NotificationHubService, useValue: { connect: () => undefined, disconnect: () => undefined, notificationReceived$: NEVER } },
      ],
    });
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue(url);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, router };
  }

  it('hides the navigation and shows where setup stands, with the way back', () => {
    status$ = new BehaviorSubject<OnboardingStatus | null>(status(2));
    const { fixture, root } = render();

    expect(fixture.componentInstance.sidenavOpened).toBeFalse();
    expect(root.querySelector('[aria-label="Toggle navigation"]')).toBeNull();
    const bar = root.querySelector('.onboarding-bar')!;
    expect(bar.textContent).toContain('Setup 40% complete');
    expect(bar.textContent).toContain('Step 3 of 5: Create Customer Package');
    expect(bar.querySelector('a[href="/onboarding"]')).toBeTruthy();
  });

  it('does not repeat the bar on the wizard itself', () => {
    status$ = new BehaviorSubject<OnboardingStatus | null>(status(2));
    const { root } = render(['Admin'], '/onboarding');

    expect(root.querySelector('.onboarding-bar')).toBeNull();
  });

  it('returns to the wizard once the checked step is done', () => {
    status$ = new BehaviorSubject<OnboardingStatus | null>(status(2));
    const { fixture, router } = render();
    refresh.and.returnValue(of(status(3)));

    fixture.componentInstance.checkOnboardingStep();

    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('stays on the screen when the step is not done yet', () => {
    status$ = new BehaviorSubject<OnboardingStatus | null>(status(2));
    const { fixture, router } = render();
    refresh.and.returnValue(of(status(2)));

    fixture.componentInstance.checkOnboardingStep();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens the full workspace as soon as onboarding completes', () => {
    status$ = new BehaviorSubject<OnboardingStatus | null>(status(4));
    const { fixture, root } = render();

    status$.next(status(5, true));
    fixture.detectChanges();

    expect(fixture.componentInstance.onboardingActive).toBeFalse();
    expect(root.querySelector('.onboarding-bar')).toBeNull();
    expect(root.querySelector('[aria-label="Toggle navigation"]')).toBeTruthy();
    expect(root.querySelectorAll('.nav-item').length).toBeGreaterThan(0);
  });

  it('takes a tenant back to the wizard when setup is undone, e.g. the only package was deleted', () => {
    status$ = new BehaviorSubject<OnboardingStatus | null>(status(5, true));
    const { fixture, router } = render(['Admin'], '/packages');
    expect(router.navigate).not.toHaveBeenCalled();

    status$.next(status(2));
    fixture.detectChanges();

    expect(fixture.componentInstance.onboardingActive).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('does not bounce a tenant that is already on the wizard', () => {
    status$ = new BehaviorSubject<OnboardingStatus | null>(status(5, true));
    const { router } = render(['Admin'], '/onboarding');

    status$.next(status(2));

    expect(router.navigate).not.toHaveBeenCalled();
  });
});

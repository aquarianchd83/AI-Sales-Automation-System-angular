import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Component, NgModule } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, RouterModule, RouterStateSnapshot } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { OnboardingStatus, OnboardingStepState } from '../../../core/models/onboarding.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { OnboardingModule } from '../onboarding.module';
import { ONBOARDING_AREAS, OnboardingArea } from '../step-panel/onboarding-areas';
import { OnboardingPageComponent, onboardingPanelGuard } from './onboarding-page.component';

// ---- a stand-in feature module: real routes, so the panel resolves screens exactly as it does for the app ----------

@Component({ selector: 'app-fake-screen', template: '<p class="fake-screen">screen of {{ area }}</p>' })
class FakeScreenComponent {
  area = '';
}

@Component({ selector: 'app-fake-detail', template: '<p class="fake-detail">detail {{ id }}</p>' })
class FakeDetailComponent {
  id: string | null = null;
  constructor(route: ActivatedRoute) {
    route.paramMap.subscribe((params) => (this.id = params.get('id')));
  }
}

@NgModule({
  declarations: [FakeScreenComponent, FakeDetailComponent],
  imports: [
    RouterModule.forChild([
      { path: '', component: FakeScreenComponent },
      { path: 'profile', component: FakeScreenComponent },
      { path: 'jobs', component: FakeScreenComponent },
      { path: ':id', component: FakeDetailComponent },
    ]),
  ],
})
class FakeFeatureModule {}

const PREFIXES = ['/profile', '/billing', '/packages', '/lead-discovery', '/tenant-settings', '/message-templates', '/customers', '/campaigns', '/knowledge-base'];
const FAKE_AREAS: OnboardingArea[] = PREFIXES.map((prefix) => ({ prefix, load: () => Promise.resolve(FakeFeatureModule) }));

const STEPS: [string, string, number, string][] = [
  ['profile', 'Profile Information', 10, '/profile'],
  ['plan', 'Select Package Plan', 10, '/billing'],
  ['customer-package', 'Create Customer Package', 15, '/packages'],
  ['lead-discovery', 'Lead Discovery Profile', 10, '/lead-discovery/profile'],
  ['whatsapp', 'WhatsApp Configuration', 15, '/tenant-settings'],
  ['message-template', 'Configure Message Template', 10, '/message-templates'],
  ['customer', 'Create Customer', 10, '/customers'],
  ['campaign', 'Create Campaign', 10, '/campaigns'],
  ['knowledge-base', 'Knowledge Base / Voucher', 10, '/knowledge-base'],
];

function status(completed: number, missing: string | null = null): OnboardingStatus {
  const steps = STEPS.map(([key, title, weight, route], i) => ({
    key,
    title,
    description: `About ${title}`,
    weight,
    route,
    state: (i < completed ? 'Completed' : i === completed ? 'Current' : 'Pending') as OnboardingStepState,
    completedAt: i < completed ? '2026-10-06T08:00:00Z' : null,
    missing: i === completed ? missing : null,
  }));
  const done = completed >= steps.length;
  return {
    isCompleted: done,
    progressPercent: steps.filter((s) => s.state === 'Completed').reduce((sum, s) => sum + s.weight, 0),
    currentStepKey: done ? null : steps[completed].key,
    completedAt: done ? '2026-10-06T09:00:00Z' : null,
    steps,
  };
}

/** Every step done except the one at `gap`, which is the one to do next - progress is by data, not by position. */
function statusWithGap(gap: number): OnboardingStatus {
  const steps = STEPS.map(([key, title, weight, route], i) => ({
    key,
    title,
    description: `About ${title}`,
    weight,
    route,
    state: (i === gap ? 'Current' : 'Completed') as OnboardingStepState,
    completedAt: i === gap ? null : '2026-10-06T08:00:00Z',
    missing: i === gap ? 'Create an active package for your customers.' : null,
  }));
  return {
    isCompleted: false,
    progressPercent: steps.filter((s) => s.state === 'Completed').reduce((sum, s) => sum + s.weight, 0),
    currentStepKey: steps[gap].key,
    completedAt: null,
    steps,
  };
}

describe('OnboardingPageComponent', () => {
  let fixture: ComponentFixture<OnboardingPageComponent>;
  let component: OnboardingPageComponent;
  let status$: BehaviorSubject<OnboardingStatus | null>;
  let onboarding: jasmine.SpyObj<OnboardingService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let router: Router;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = (): HTMLElement => fixture.nativeElement;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function create(initial: OnboardingStatus | null, roles = ['Admin']): Promise<void> {
    status$ = new BehaviorSubject<OnboardingStatus | null>(initial);
    onboarding = jasmine.createSpyObj<OnboardingService>('OnboardingService', ['refresh'], { status$: status$.asObservable() });
    onboarding.refresh.and.returnValue(of(initial));
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'info', 'error']);
    const auth = { hasAnyRole: (wanted: string[]) => wanted.some((r) => roles.includes(r)) };

    TestBed.configureTestingModule({
      imports: [OnboardingModule, HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: OnboardingService, useValue: onboarding },
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notify },
        { provide: ONBOARDING_AREAS, useValue: FAKE_AREAS },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(OnboardingPageComponent);
    component = fixture.componentInstance;
    await settle();
  }

  /** The refresh the service would do: publish the new status, then hand it back. */
  function refreshTo(next: OnboardingStatus): void {
    onboarding.refresh.and.callFake(() => {
      status$.next(next);
      return of(next);
    });
  }

  const leave = (url: string): boolean =>
    TestBed.runInInjectionContext(() =>
      onboardingPanelGuard(component, {} as never, {} as RouterStateSnapshot, { url } as RouterStateSnapshot)
    ) as boolean;

  it('AC04: shows the header, the weighted progress and every step with its weight', async () => {
    await create(status(4, 'Verify the connection.'));

    expect(text()).toContain('Complete Your Application Setup');
    expect(text()).toContain('45%'); // 10 + 10 + 15 + 10
    const steps = Array.from(el().querySelectorAll('.step'));
    expect(steps.length).toBe(9);
    expect(steps[4].textContent).toContain('WhatsApp Configuration');
    expect(steps[4].textContent).toContain('15%');
  });

  it('says what each step is - done, to do, or waiting - and never shows a padlock', async () => {
    await create(status(4));

    const steps = Array.from(el().querySelectorAll('.step'));
    expect(steps[0].classList).toContain('step--completed');
    expect(steps[0].textContent).toContain('Done');
    expect(steps[4].classList).toContain('step--current');
    expect(steps[4].classList).toContain('step--selected');
    expect(steps[4].textContent).toContain('To do');
    expect(steps[5].classList).toContain('step--pending');
    expect(steps[5].textContent).toContain('Waiting');
    expect(steps[5].getAttribute('aria-disabled')).toBe('true');
    expect(text()).not.toContain('lock');
  });

  it('counts every step that has its data, wherever the gap is, and names what is still to do', async () => {
    await create(statusWithGap(2)); // everything but the package step

    expect(text()).toContain('85%');
    expect(text()).toContain('8 of 9 steps done.');
    expect(text()).toContain('Still to do:');
    expect(el().querySelector('.todo')!.textContent).toContain('Create Customer Package');
    const steps = Array.from(el().querySelectorAll('.step'));
    expect(steps.filter((s) => s.classList.contains('step--completed')).length).toBe(8);
    expect(steps.filter((s) => s.classList.contains('step--pending')).length).toBe(0);
    expect(el().querySelector('.panel-head h2')!.textContent).toContain('Create Customer Package');
    expect(el().querySelector('.chip--current')!.textContent).toContain('To do');
  });

  it('lets the Admin open any step that has its data, even after the one still to do', async () => {
    await create(statusWithGap(2));

    component.select(component.status!.steps[7]); // campaign: done, and after the gap
    await settle();

    expect(component.panelUrl).toBe('/campaigns');
    expect(el().querySelector('.panel-head h2')!.textContent).toContain('Create Campaign');
    expect(el().querySelector('.chip--completed')).toBeTruthy();
  });

  it('lays the panel out as title, then the screen, then Previous and Next', async () => {
    await create(status(4));

    const panel = el().querySelector('.panel')!;
    const order = ['.panel-head', '.panel-body', '.panel-nav'].map((sel) => Array.from(panel.children).indexOf(panel.querySelector(sel)!));
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(order.every((i) => i >= 0)).toBeTrue();
    const labels = Array.from(panel.querySelectorAll('.panel-nav button')).map((b) => b.textContent!.replace(/arrow_(back|forward)/g, '').trim());
    expect(labels).toEqual(['Previous', 'Next']);
  });

  it('goes back and forward between open steps, and holds Next while the step on screen is still to do', async () => {
    await create(status(4)); // WhatsApp is the one to do
    const nav = (label: string): HTMLButtonElement =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('.panel-nav button')).find((b) => b.textContent!.includes(label))!;

    expect(nav('Next').disabled).toBeTrue(); // the next step waits behind this one
    expect(el().querySelector('.nav-hint')!.textContent).toContain('Finish WhatsApp Configuration to go on.');

    nav('Previous').click();
    await settle();
    expect(component.selected?.key).toBe('lead-discovery');
    expect(nav('Next').disabled).toBeFalse(); // WhatsApp is open

    nav('Next').click();
    await settle();
    expect(component.selected?.key).toBe('whatsapp');
  });

  it('disables Previous on the first step', async () => {
    await create(status(0));

    const previous = Array.from(el().querySelectorAll<HTMLButtonElement>('.panel-nav button')).find((b) => b.textContent!.includes('Previous'))!;
    expect(previous.disabled).toBeTrue();
  });

  it("AC05: shows the first incomplete step's real screen in the panel, with what is missing", async () => {
    await create(status(4, 'Verify the connection.'));

    expect(component.panelUrl).toBe('/tenant-settings');
    expect(el().querySelector('.panel-head h2')!.textContent).toContain('WhatsApp Configuration');
    expect(text()).toContain('Step 5 of 9');
    expect(el().querySelector('.banner--missing')!.textContent).toContain('Verify the connection.');
    expect(el().querySelector('.panel-body .fake-screen')).toBeTruthy();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('switches the panel when a completed step is clicked, never leaving the page, and ignores a waiting one', async () => {
    await create(status(4));

    component.select(component.status!.steps[0]);
    await settle();
    expect(component.panelUrl).toBe('/profile');
    expect(el().querySelector('.panel-head h2')!.textContent).toContain('Profile Information');
    expect(el().querySelector('.chip--completed')!.textContent).toContain('Done');

    component.select(component.status!.steps[7]);
    expect(component.panelUrl).toBe('/profile');
  });

  it('opens what a step links to inside the panel, with its parameters, and offers the way back', async () => {
    await create(status(7)); // customers step completed, campaign current

    expect(leave('/campaigns/42')).toBeFalse(); // navigation cancelled, shown in place
    await settle();

    expect(component.selected?.key).toBe('campaign');
    expect(el().querySelector('.panel-body .fake-detail')!.textContent).toContain('detail 42');
    expect(component.isDeeper).toBeTrue();

    component.backToStep();
    await settle();
    expect(component.panelUrl).toBe('/campaigns');
    expect(el().querySelector('.panel-body .fake-screen')).toBeTruthy();
  });

  it('maps a relative link from the screen on show back into the panel', async () => {
    await create(status(7));
    component.select(component.status!.steps[6]); // customers

    expect(leave('/onboarding/7')).toBeFalse();
    expect(component.panelUrl).toBe('/customers/7');
  });

  it('refuses a link into a waiting step, and lets everything else through', async () => {
    await create(status(4));

    expect(leave('/campaigns/42')).toBeFalse();
    expect(notify.info).toHaveBeenCalledWith('Finish the earlier steps before Create Campaign.');
    expect(component.panelUrl).toBe('/tenant-settings');

    expect(leave('/login')).toBeTrue();
    expect(leave('/account/profile')).toBeTrue();
  });

  it('ticks a step off by itself and offers the next one, without moving the panel', async () => {
    await create(status(4));

    status$.next(status(5)); // e.g. the connection was just verified in the panel
    await settle();

    expect(component.selected?.key).toBe('whatsapp');
    expect(component.panelUrl).toBe('/tenant-settings');
    const banner = el().querySelector('.banner--done')!;
    expect(banner.textContent).toContain('WhatsApp Configuration is complete.');
    expect(text()).toContain('60%');

    // Next now leads on to the step still to do.
    const next = Array.from(el().querySelectorAll<HTMLButtonElement>('.panel-nav button')).find((b) => b.textContent!.includes('Next'))!;
    expect(next.disabled).toBeFalse();
    next.click();
    await settle();
    expect(component.selected?.key).toBe('message-template');
    expect(component.panelUrl).toBe('/message-templates');
  });

  it('says so when the checked step is still not done', async () => {
    await create(status(4));
    refreshTo(status(4, 'Verify the connection.'));

    component.check();

    expect(notify.info).toHaveBeenCalledWith('This step is not complete yet.');
  });

  it('AC12: shows the finished state at 100%, lets links go, and goes on to the dashboard', async () => {
    await create(status(9));

    expect(text()).toContain('100%');
    expect(text()).toContain('Your setup is complete');
    expect(el().querySelector('.steps')).toBeNull();
    expect(leave('/campaigns')).toBeTrue();

    (el().querySelector('.done button') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('shows other tenant users a read-only waiting screen, with no step screens', async () => {
    await create(status(4), ['SalesAgent']);

    expect(text()).toContain('Your administrator is setting up your workspace');
    expect(text()).toContain('Your administrator is on step 5 of 9: WhatsApp Configuration.');
    expect(el().querySelector('app-onboarding-step-host')).toBeNull();
    expect(leave('/tenant-settings')).toBeTrue(); // not intercepted; the onboarding guard sends them back
  });

  it('loads the status itself when nothing is cached yet', async () => {
    await create(null);
    expect(onboarding.refresh).toHaveBeenCalled();
  });

  describe('keeping the new step in view', () => {
    let scrolled: jasmine.Spy;
    const nav = (label: string): HTMLButtonElement =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('.panel-nav button')).find((b) => b.textContent!.includes(label))!;

    beforeEach(() => {
      scrolled = spyOn(Element.prototype, 'scrollIntoView');
    });

    it('does not scroll when the page first opens', async () => {
      await create(status(4));

      expect(scrolled).not.toHaveBeenCalled();
    });

    it('brings the panel back to the top after Next and after Previous - they sit at the bottom of it', async () => {
      await create(status(4));

      // Each change scrolls at once and again when the new screen has arrived.
      nav('Previous').click();
      await settle();
      expect(scrolled).toHaveBeenCalledTimes(2);
      expect((scrolled.calls.mostRecent().object as HTMLElement).classList).toContain('panel');

      nav('Next').click();
      await settle();
      expect(scrolled).toHaveBeenCalledTimes(4);
    });

    it('does the same when a step is clicked in the list, or a link opens in the panel', async () => {
      await create(status(7));

      component.select(component.status!.steps[0]);
      await settle();
      expect(scrolled).toHaveBeenCalledTimes(2);

      TestBed.runInInjectionContext(() => onboardingPanelGuard(component, {} as never, {} as RouterStateSnapshot, { url: '/customers/7' } as RouterStateSnapshot));
      await settle();
      expect(scrolled).toHaveBeenCalledTimes(4);
    });

    it('scrolls again once a screen that was slow to load has arrived - the swap changes the page height', async () => {
      await create(status(4));

      // A different url: scroll at once, and again when the host says the new screen has arrived.
      nav('Previous').click();
      expect(component['scrollPending']).toBeTrue();
      await settle();
      expect(scrolled).toHaveBeenCalledTimes(2);
      expect(component['scrollPending']).toBeFalse();

      component.onRendered(); // only once per step change
      expect(scrolled).toHaveBeenCalledTimes(2);
    });

    it('does not wait for a screen when the url did not change', async () => {
      await create(status(4));

      component.select(component.status!.steps[4]); // already on it
      await settle();
      expect(scrolled).toHaveBeenCalledTimes(1);

      component.onRendered();
      expect(scrolled).toHaveBeenCalledTimes(1);
    });

    it('leaves the page where it is when progress ticks over by itself', async () => {
      await create(status(4));

      status$.next(status(5));
      await settle();

      expect(scrolled).not.toHaveBeenCalled();
    });
  });
});

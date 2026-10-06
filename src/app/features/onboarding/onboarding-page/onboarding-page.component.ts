import { Component, ElementRef, Inject, OnDestroy, OnInit } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { OnboardingStatus, OnboardingStep, currentStep } from '../../../core/models/onboarding.model';
import { TENANT_ADMIN_ROLES } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { ONBOARDING_AREAS, OnboardingArea, areaFor } from '../step-panel/onboarding-areas';

/**
 * "Complete Your Application Setup" - the onboarding widget a tenant lands on after signing in until all nine
 * steps are done. Two parts: the weighted step list on the left, and on the right the step itself - title, its real
 * screen shown in place, then Previous / Next.
 *
 * Every step is judged on its own data, so progress is the weight of whatever is already in place. A step with its
 * data is open; so is the first one still to do. Any others still to do are disabled (not "locked" - nothing is
 * locked from changing) until that one is done. The tenant never leaves this page: anything the screen links to (a campaign's detail
 * page, a related setting) opens in the same panel (see `interceptNavigation` and the route's canDeactivate).
 *
 * Saving anything re-checks progress in the background, so the list ticks off by itself; when the step being
 * worked on completes, a banner offers the next one - the panel never jumps away on its own.
 *
 * Everyone else in the tenant sees the same progress, read-only, while they wait for the Admin.
 */
@Component({
  selector: 'app-onboarding-page',
  templateUrl: './onboarding-page.component.html',
  styleUrls: ['./onboarding-page.component.scss'],
})
export class OnboardingPageComponent implements OnInit, OnDestroy {
  readonly isAdmin = this.auth.hasAnyRole(TENANT_ADMIN_ROLES);

  status: OnboardingStatus | null = null;
  /** The step whose screen the panel shows. */
  selected: OnboardingStep | null = null;
  /** What the panel shows: the step's screen, or a screen it led to (e.g. one campaign). */
  panelUrl: string | null = null;
  /** Set when the step on screen has just been completed - the banner offering the next step. */
  justCompleted: OnboardingStep | null = null;
  checking = false;
  loadFailed = false;

  private scrollPending = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly notify: NotificationService,
    @Inject(ONBOARDING_AREAS) private readonly areas: OnboardingArea[],
    private readonly host: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.onboarding.status$.pipe(takeUntil(this.destroy$)).subscribe((status) => this.apply(status));
    // The guard has normally just read it; read again only when nothing is cached (a direct load of this page).
    if (!this.status) {
      this.check(false);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get current(): OnboardingStep | null {
    return currentStep(this.status);
  }

  get stepCount(): number {
    return this.status?.steps.length ?? 0;
  }

  get doneCount(): number {
    return this.status?.steps.filter((s) => s.state === 'Completed').length ?? 0;
  }

  /** Steps not done yet, in order - the first is the one to do next. */
  get todo(): OnboardingStep[] {
    return this.status?.steps.filter((s) => s.state !== 'Completed') ?? [];
  }

  get previousStep(): OnboardingStep | null {
    const i = this.selected ? this.status?.steps.indexOf(this.selected) ?? -1 : -1;
    return i > 0 ? this.status!.steps[i - 1] : null;
  }

  get nextStep(): OnboardingStep | null {
    const i = this.selected ? this.status?.steps.indexOf(this.selected) ?? -1 : -1;
    return i >= 0 && i < this.stepCount - 1 ? this.status!.steps[i + 1] : null;
  }

  /** Next is available once the step after the one on screen is open. A step still to do holds the way on. */
  get canGoNext(): boolean {
    const next = this.nextStep;
    return !!next && next.state !== 'Pending';
  }

  /** Why Next is not available, for a tooltip. */
  get nextHint(): string {
    if (!this.nextStep) {
      return 'This is the last step.';
    }
    return this.canGoNext ? '' : `Finish ${this.current?.title ?? 'this step'} to go on.`;
  }

  /** What a step's row says under its title. */
  stateLabel(step: OnboardingStep): string {
    switch (step.state) {
      case 'Completed':
        return 'Done';
      case 'Current':
        return 'To do';
      default:
        return 'Waiting';
    }
  }

  previous(): void {
    const step = this.previousStep;
    if (step) {
      this.select(step);
    }
  }

  next(): void {
    const step = this.nextStep;
    if (step && this.canGoNext) {
      this.select(step);
    }
  }

  /** The panel is showing a screen inside the step (one campaign, say) rather than the step's own screen. */
  get isDeeper(): boolean {
    return !!this.selected && !!this.panelUrl && this.panelUrl !== this.selected.route;
  }

  stepNumber(step: OnboardingStep): number {
    return (this.status?.steps.indexOf(step) ?? 0) + 1;
  }

  /** Done is a tick, to do is an open circle with a dot, waiting is an empty circle. Never a padlock: nothing here is locked. */
  icon(step: OnboardingStep): string {
    switch (step.state) {
      case 'Completed':
        return 'check_circle';
      case 'Current':
        return 'pending';
      default:
        return 'radio_button_unchecked';
    }
  }

  /** Shows a step's screen in the panel. A step still waiting behind the one to do next cannot be opened. */
  select(step: OnboardingStep, scrollIntoView = true): void {
    if (step.state === 'Pending') {
      return;
    }
    const changed = this.panelUrl !== step.route;
    this.selected = step;
    this.panelUrl = step.route;
    this.justCompleted = null;
    if (scrollIntoView) {
      this.showPanel(changed);
    }
  }

  /** From a screen inside the step back to the step's own screen. */
  backToStep(): void {
    if (this.selected) {
      const changed = this.panelUrl !== this.selected.route;
      this.panelUrl = this.selected.route;
      this.showPanel(changed);
    }
  }

  /** The screen for the url has arrived in the panel: if a step change is waiting to be shown, show it now. */
  onRendered(): void {
    if (this.scrollPending) {
      this.scrollPending = false;
      this.scrollPanelIntoView();
    }
  }

  /**
   * Brings the panel back into view when the step on it changes. Next and Previous sit at the bottom of the panel, so
   * the page is scrolled down when they are pressed; without this the new step's title and the top of its screen are
   * left above the visible area, and what is in view is only its tail - which reads as "nothing changed".
   *
   * It scrolls at once, and again when the new screen has actually arrived (`waitForScreen`): a step visited for the
   * first time loads its code from the network, so the old content is still there when the click is handled, and the
   * swap changes the height of the page after the first scroll has already happened.
   */
  private showPanel(waitForScreen: boolean): void {
    this.scrollPending = waitForScreen;
    setTimeout(() => this.scrollPanelIntoView());
  }

  private scrollPanelIntoView(): void {
    this.host.nativeElement.querySelector('.panel')?.scrollIntoView?.({ block: 'start' });
  }

  continueToCurrent(): void {
    const next = this.current;
    if (next) {
      this.select(next);
    }
  }

  /**
   * Called before the router leaves this page. A link to a screen that belongs to an open step is shown in the panel
   * instead (and the navigation cancelled); so is a relative link, which resolves under /onboarding. Returns true
   * when it handled the navigation.
   */
  interceptNavigation(url: string): boolean {
    if (!this.isAdmin || !this.status || this.status.isCompleted) {
      return false;
    }
    const path = url.split(/[?#]/)[0];

    if (path.startsWith('/onboarding/')) {
      const base = (this.panelUrl ?? this.selected?.route ?? '').replace(/\/+$/, '');
      const target = `${base}/${path.slice('/onboarding/'.length)}`;
      const changed = this.panelUrl !== target;
      this.panelUrl = target;
      this.showPanel(changed);
      return true;
    }

    const step = this.stepFor(path);
    if (!step) {
      return false;
    }
    if (step.state === 'Pending') {
      this.notify.info(`Finish the earlier steps before ${step.title}.`);
      return true;
    }
    this.selected = step;
    const changed = this.panelUrl !== path;
    this.panelUrl = path;
    this.justCompleted = null;
    this.showPanel(changed);
    return true;
  }

  /** Reads the status again; with `announce`, says whether the current step is now done. */
  check(announce = true): void {
    if (this.checking) {
      return;
    }
    const before = this.current?.key ?? null;
    this.checking = true;
    this.loadFailed = false;
    this.onboarding
      .refresh()
      .pipe(finalize(() => (this.checking = false)))
      .subscribe({
        next: (status) => {
          if (!announce || !status) {
            return;
          }
          if (status.isCompleted) {
            this.notify.success('Setup complete. Welcome aboard!');
          } else if (status.currentStepKey === before) {
            this.notify.info('This step is not complete yet.');
          }
        },
        error: () => (this.loadFailed = true),
      });
  }

  finish(): void {
    void this.router.navigate(['/dashboard']);
  }

  trackStep(_: number, step: OnboardingStep): string {
    return step.key;
  }

  private stepFor(path: string): OnboardingStep | undefined {
    const area = areaFor(this.areas, path)?.area;
    return area ? this.status?.steps.find((s) => areaFor(this.areas, s.route)?.area === area) : undefined;
  }

  private apply(status: OnboardingStatus | null): void {
    const wasOnScreen = this.selected;
    this.status = status;
    if (!status) {
      this.selected = null;
      this.panelUrl = null;
      return;
    }

    if (!this.selected) {
      this.select(currentStep(status) ?? status.steps[0], false); // opening the page: stay at the top, under the header
      return;
    }

    // Keep the step on screen (with whatever the tenant is doing in it) and refresh its state.
    this.selected = status.steps.find((s) => s.key === wasOnScreen!.key) ?? currentStep(status);
    if (wasOnScreen?.state === 'Current' && this.selected?.state === 'Completed') {
      this.justCompleted = this.selected;
    }
  }
}

/** Keeps the tenant on the onboarding page: links from the step on screen open in its panel. */
export const onboardingPanelGuard: CanDeactivateFn<OnboardingPageComponent> = (component, _route, _state, next) =>
  !component.interceptNavigation(next.url);

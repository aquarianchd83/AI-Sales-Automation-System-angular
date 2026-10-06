import {
  ChangeDetectorRef,
  Component,
  EnvironmentInjector,
  EventEmitter,
  Inject,
  Injector,
  Input,
  NgModuleRef,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  ViewContainerRef,
  createNgModule,
} from '@angular/core';
import { ActivatedRoute, ROUTES, Route, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { ONBOARDING_AREAS, OnboardingArea, areaFor, matchRoute } from './onboarding-areas';

/**
 * Shows the real screen for a URL - the business profile, the packages list, a campaign's detail page - inside the
 * onboarding panel, without leaving the wizard. It loads the screen's feature module and picks the component from
 * that module's own routes, the way the router would.
 *
 * The screen gets an ActivatedRoute carrying the URL's `:id`-style parameters. Anything it navigates to is caught by
 * the onboarding page (its canDeactivate) and shown here instead, so the tenant keeps their place.
 */
@Component({
  selector: 'app-onboarding-step-host',
  template: `
    <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>
    <p class="host-failed muted" *ngIf="failed">
      <mat-icon>visibility_off</mat-icon>
      This screen can't be shown here.
    </p>
    <ng-container #outlet></ng-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .host-failed {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 24px;
      }
    `,
  ],
})
export class OnboardingStepHostComponent implements OnChanges, OnDestroy {
  @Input() url: string | null = null;

  /** Fires when the screen for the current url is in place (or could not be shown) - not for one that was superseded
   * by a newer url while it loaded. The page uses it to scroll to a screen that arrived after the click. */
  @Output() rendered = new EventEmitter<void>();

  @ViewChild('outlet', { read: ViewContainerRef, static: true }) outlet!: ViewContainerRef;

  loading = false;
  failed = false;

  private readonly modules = new Map<string, NgModuleRef<unknown>>();
  private renderSeq = 0;

  constructor(
    @Inject(ONBOARDING_AREAS) private readonly areas: OnboardingArea[],
    private readonly environment: EnvironmentInjector,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(): void {
    void this.render();
  }

  ngOnDestroy(): void {
    this.outlet.clear();
    this.modules.forEach((ref) => ref.destroy());
    this.modules.clear();
  }

  private async render(): Promise<void> {
    const seq = ++this.renderSeq;
    this.failed = false;
    this.outlet.clear();
    if (!this.url) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();
    try {
      const found = areaFor(this.areas, this.url);
      if (!found) {
        throw new Error(`No onboarding area for ${this.url}`);
      }
      const moduleRef = await this.moduleFor(found.area);
      if (seq !== this.renderSeq) {
        return; // a newer URL arrived while this one loaded
      }

      const routes = (moduleRef.injector.get(ROUTES, []) as Route[][]).flat();
      const match = matchRoute(routes, found.rest);
      if (!match) {
        throw new Error(`No screen for ${this.url}`);
      }

      const injector = Injector.create({
        providers: [{ provide: ActivatedRoute, useValue: this.routeWith(match.params, match.route.data ?? {}) }],
        parent: moduleRef.injector,
      });
      this.outlet.clear();
      this.outlet.createComponent(match.route.component!, { injector, ngModuleRef: moduleRef });
    } catch (error) {
      console.error(`Onboarding panel could not show ${this.url}`, error);
      if (seq === this.renderSeq) {
        this.outlet.clear();
        this.failed = true;
      }
    } finally {
      if (seq === this.renderSeq) {
        this.loading = false;
        this.cdr.markForCheck();
        this.rendered.emit();
      }
    }
  }

  private async moduleFor(area: OnboardingArea): Promise<NgModuleRef<unknown>> {
    let ref = this.modules.get(area.prefix);
    if (!ref) {
      ref = createNgModule(await area.load(), this.environment);
      this.modules.set(area.prefix, ref);
    }
    return ref;
  }

  /**
   * The wizard's own route, with the screen's parameters laid over it. Inheriting from the real route keeps relative
   * navigation working: it resolves under /onboarding, which the onboarding page maps back into this panel.
   */
  private routeWith(params: Record<string, string>, data: Record<string, unknown>): ActivatedRoute {
    const paramMap = convertToParamMap(params);
    const snapshot = Object.create(this.route.snapshot, {
      params: { value: params },
      paramMap: { value: paramMap },
      data: { value: data },
    });
    return Object.create(this.route, {
      params: { value: of(params) },
      paramMap: { value: of(paramMap) },
      data: { value: of(data) },
      snapshot: { value: snapshot },
    }) as ActivatedRoute;
  }
}

import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of } from 'rxjs';

import { EntitlementsService } from '../services/entitlements.service';
import { NotificationService } from '../services/notification.service';
import { featureGuard } from './feature.guard';
import { FEATURE_PREVIEWS } from '../models/feature-preview.model';
import { PLATFORM_FEATURES, PlatformFeature } from '../models/wallet.model';

describe('featureGuard', () => {
  function run(has: boolean, feature: PlatformFeature = 'ContentStudio'): Observable<boolean | UrlTree> {
    const notify = jasmine.createSpyObj('NotificationService', ['error']);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        { provide: EntitlementsService, useValue: { load: () => of(null), has: () => has, canView: () => has } },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const route = { data: { feature } } as unknown as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => featureGuard(route, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>;
    (run as unknown as { notify: unknown }).notify = notify;
    return result;
  }

  it('lets a tenant in when the feature is in the plan', (done) => {
    run(true).subscribe((r) => {
      expect(r).toBeTrue();
      done();
    });
  });

  it("sends a tenant to the feature's preview page, not the dashboard, and raises no toast", (done) => {
    run(false).subscribe((r) => {
      expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/premium/content-studio');
      expect(((run as unknown as { notify: { error: jasmine.Spy } }).notify).error).not.toHaveBeenCalled();
      done();
    });
  });

  PLATFORM_FEATURES.forEach((feature) => {
    it(`routes a locked ${feature} screen to its own preview`, (done) => {
      run(false, feature).subscribe((r) => {
        expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe(`/premium/${FEATURE_PREVIEWS[feature].slug}`);
        done();
      });
    });
  });

  it('lets a tenant in, read-only, once its free uses of the feature are used up', (done) => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: EntitlementsService, useValue: { load: () => of(null), has: () => false, canView: () => true } }],
    });
    const route = { data: { feature: 'LeadDiscovery' } } as unknown as ActivatedRouteSnapshot;
    (TestBed.runInInjectionContext(() => featureGuard(route, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>).subscribe((r) => {
      expect(r).toBeTrue();
      done();
    });
  });

  it('lets any screen with no feature through without asking for the plan', () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: EntitlementsService, useValue: { load: () => { throw new Error('not asked'); }, has: () => false } }],
    });
    const route = { data: {} } as unknown as ActivatedRouteSnapshot;
    expect(TestBed.runInInjectionContext(() => featureGuard(route, {} as RouterStateSnapshot))).toBeTrue();
  });
});

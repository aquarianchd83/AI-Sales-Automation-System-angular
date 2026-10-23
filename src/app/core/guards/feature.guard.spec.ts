import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of } from 'rxjs';

import { EntitlementsService } from '../services/entitlements.service';
import { NotificationService } from '../services/notification.service';
import { featureGuard } from './feature.guard';

describe('featureGuard', () => {
  function run(has: boolean): Observable<boolean | UrlTree> {
    const notify = jasmine.createSpyObj('NotificationService', ['error']);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        { provide: EntitlementsService, useValue: { load: () => of(null), has: () => has } },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const route = { data: { feature: 'ContentStudio' } } as unknown as ActivatedRouteSnapshot;
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

  it('sends a tenant to the dashboard, where the upgrade badge is, and raises no toast', (done) => {
    run(false).subscribe((r) => {
      expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/dashboard');
      expect(((run as unknown as { notify: { error: jasmine.Spy } }).notify).error).not.toHaveBeenCalled();
      done();
    });
  });
});

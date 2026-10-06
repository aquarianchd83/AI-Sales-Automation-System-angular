import { inject } from '@angular/core';
import { CanActivateChildFn, Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { isOpenStepUrl } from '../models/onboarding.model';
import { PLATFORM_ADMIN_ROLES } from '../models/platform.model';
import { TENANT_ADMIN_ROLES } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';

/** Always reachable while onboarding: the wizard itself and the user's own account (password, profile). */
const ALWAYS_OPEN = ['/onboarding', '/account', '/change-password'];

/**
 * Holds a tenant in onboarding until it is complete. The tenant's Admin may use the wizard and the screens of the
 * steps it has reached (completed or current) - each step is done on its real screen - and is sent back to the
 * wizard from anywhere else. Every other tenant user waits on the wizard's progress screen.
 *
 * Not applied to a PlatformSuperAdmin (no tenant) or to a support session: an operator helping a tenant must be
 * able to look anywhere. If the status cannot be read the user is let through rather than locked out - the API
 * still enforces what matters (e.g. no customer package before a plan).
 */
export const onboardingGuard: CanActivateChildFn = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const onboarding = inject(OnboardingService);

  if (!auth.isAuthenticated || auth.isImpersonating || auth.hasAnyRole(PLATFORM_ADMIN_ROLES)) {
    return true;
  }

  const path = state.url.split(/[?#]/)[0];
  if (ALWAYS_OPEN.some((open) => path === open || path.startsWith(open + '/'))) {
    // Still refresh, so the shell knows where onboarding stands on a direct visit to the wizard.
    return onboarding.current().pipe(
      map(() => true),
      catchError(() => of(true))
    );
  }

  return onboarding.current().pipe(
    map((status) => {
      if (!status || status.isCompleted) {
        return true;
      }
      if (auth.hasAnyRole(TENANT_ADMIN_ROLES) && isOpenStepUrl(status, path)) {
        return true;
      }
      return router.createUrlTree(['/onboarding']);
    }),
    catchError(() => of(true))
  );
};

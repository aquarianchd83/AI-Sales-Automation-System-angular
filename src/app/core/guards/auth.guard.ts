import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateChildFn,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

import { PLATFORM_ADMIN_ROLES } from '../models/platform.model';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';

/** Blocks routes for signed-out users, remembering where they were headed. */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Route-level role check. Reads `data.roles` from the route; an empty or missing
 * list means "any signed-in user". This is a UX guard only — the API enforces
 * authorization for real, so a tampered token buys nothing but a broken screen.
 */
export const roleGuard: CanActivateFn & CanActivateChildFn = (
  route: ActivatedRouteSnapshot
) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotificationService);

  const required = (route.data['roles'] as string[] | undefined) ?? [];
  if (auth.hasAnyRole(required)) {
    return true;
  }

  notify.error('You do not have access to that area.');
  return router.createUrlTree([homePath(auth)]);
};

/** Keeps signed-in users off /login. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated ? router.createUrlTree([homePath(auth)]) : true;
};

/**
 * Sends `/` (and anywhere else a guard needs to bounce to "home") to the right place for the
 * signed-in account: `/platform` for a PlatformSuperAdmin — who has no tenant, so every ordinary
 * tenant screen (Dashboard, Customers, Inbox, ...) is meaningless for that role — and `/dashboard`
 * for everyone else. A plain `redirectTo: 'dashboard'` on the `''` route can't branch on the
 * signed-in user, so this replaces that static redirect.
 */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return router.createUrlTree([homePath(auth)]);
};

function homePath(auth: AuthService): string {
  return auth.hasAnyRole(PLATFORM_ADMIN_ROLES) ? '/platform' : '/dashboard';
}

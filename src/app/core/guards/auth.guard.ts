import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateChildFn,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

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
  return router.createUrlTree(['/dashboard']);
};

/** Keeps signed-in users off /login. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated ? router.createUrlTree(['/dashboard']) : true;
};

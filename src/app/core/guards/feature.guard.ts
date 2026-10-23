import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';

import { PlatformFeature } from '../models/wallet.model';
import { EntitlementsService } from '../services/entitlements.service';

/**
 * Keeps a tenant out of a screen whose feature is not in its plan and sends them to the dashboard, where an upgrade badge names each feature
 * their plan lacks and links to the plans page - a prompt that stays put, not a toast that vanishes. Reads `data.feature` from the route. The API refuses the same requests, so this only spares the user a screen that would be full of errors.
 */
export const featureGuard: CanActivateFn & CanActivateChildFn = (route) => {
  const feature = route.data['feature'] as PlatformFeature | undefined;
  if (!feature) {
    return true;
  }

  const entitlements = inject(EntitlementsService);
  const router = inject(Router);

  return entitlements.load().pipe(
    map(() => {
      if (entitlements.has(feature)) {
        return true;
      }
      return router.createUrlTree(['/dashboard']);
    })
  );
};

/** For a screen with no feature of its own: loads the entitlements so the menu is right, and always lets the user in. */
export const loadEntitlementsGuard: CanActivateChildFn = () => {
  const entitlements = inject(EntitlementsService);
  return entitlements.load().pipe(map(() => true));
};


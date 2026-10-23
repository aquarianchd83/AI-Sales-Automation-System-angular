import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';

import { PlatformFeature, PLATFORM_FEATURE_LABELS } from '../models/wallet.model';
import { EntitlementsService } from '../services/entitlements.service';
import { NotificationService } from '../services/notification.service';

/**
 * Keeps a tenant out of a screen whose feature is not in its plan, and says why - with the way forward (the plans page), not a dead end. Reads
 * `data.feature` from the route. The API refuses the same requests, so this only spares the user a screen that would be full of errors.
 */
export const featureGuard: CanActivateFn & CanActivateChildFn = (route) => {
  const feature = route.data['feature'] as PlatformFeature | undefined;
  if (!feature) {
    return true;
  }

  const entitlements = inject(EntitlementsService);
  const router = inject(Router);
  const notify = inject(NotificationService);

  return entitlements.load().pipe(
    map(() => {
      if (entitlements.has(feature)) {
        return true;
      }
      notify.error(`${PLATFORM_FEATURE_LABELS[feature]} is not part of your plan. Upgrade to Premium to use it.`);
      return router.createUrlTree(['/billing']);
    })
  );
};

/** For a screen with no feature of its own: loads the entitlements so the menu is right, and always lets the user in. */
export const loadEntitlementsGuard: CanActivateChildFn = () => {
  const entitlements = inject(EntitlementsService);
  return entitlements.load().pipe(map(() => true));
};


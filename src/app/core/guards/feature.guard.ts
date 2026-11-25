import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';

import { featurePreviewCommands } from '../models/feature-preview.model';
import { PlatformFeature } from '../models/wallet.model';
import { EntitlementsService } from '../services/entitlements.service';

/**
 * Keeps a tenant out of a screen whose feature is not in its plan and sends them to that feature's preview page (/premium/<slug>), which says what the
 * feature does and how to get it - a page that stays put, not a toast that vanishes. A feature whose free uses are used up is not locked: its screens open
 * read-only. Reads `data.feature` from the route. The API refuses the same
 * requests, so this only spares the user a screen that would be full of errors.
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
      // Used up free uses leave the screen open read-only: the tenant keeps seeing what it made, the screen disables adding new.
      if (entitlements.canView(feature)) {
        return true;
      }
      return router.createUrlTree(featurePreviewCommands(feature));
    })
  );
};

/** For a screen with no feature of its own: loads the entitlements so the menu is right, and always lets the user in. */
export const loadEntitlementsGuard: CanActivateChildFn = () => {
  const entitlements = inject(EntitlementsService);
  return entitlements.load().pipe(map(() => true));
};


import { InjectionToken } from '@angular/core';

/**
 * Provided (as true) by the onboarding panel to every screen it shows. A screen that is also a full page of its own
 * can inject it, optionally, to leave out what does not belong in a guided step - the Billing screen drops its payment
 * history and the shortcut to usage and credits, for example. Absent everywhere else, so the normal pages are unchanged.
 */
export const EMBEDDED_IN_ONBOARDING = new InjectionToken<boolean>('EMBEDDED_IN_ONBOARDING');

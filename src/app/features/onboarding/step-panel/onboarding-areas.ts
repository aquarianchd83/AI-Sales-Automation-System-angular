import { InjectionToken, Type } from '@angular/core';
import { Route } from '@angular/router';

/**
 * A part of the app whose screens can be shown inside the onboarding panel: the URL prefix it owns and how to load
 * its feature module. The module's own routes decide which component a URL shows, exactly as the router would - so
 * the onboarding wizard reuses the real screens and can never drift from them.
 */
export interface OnboardingArea {
  prefix: string;
  load: () => Promise<Type<unknown>>;
}

const DEFAULT_AREAS: OnboardingArea[] = [
  { prefix: '/profile', load: () => import('../../business-profile/business-profile.module').then((m) => m.BusinessProfileModule) },
  { prefix: '/billing', load: () => import('../../billing/billing.module').then((m) => m.BillingModule) },
  { prefix: '/packages', load: () => import('../../packages/packages.module').then((m) => m.PackagesModule) },
  { prefix: '/lead-discovery', load: () => import('../../lead-discovery/lead-discovery.module').then((m) => m.LeadDiscoveryModule) },
  { prefix: '/tenant-settings', load: () => import('../../tenant-settings/tenant-settings.module').then((m) => m.TenantSettingsModule) },
  { prefix: '/message-templates', load: () => import('../../message-templates/message-templates.module').then((m) => m.MessageTemplatesModule) },
  { prefix: '/customers', load: () => import('../../customers/customers.module').then((m) => m.CustomersModule) },
  { prefix: '/campaigns', load: () => import('../../campaigns/campaigns.module').then((m) => m.CampaignsModule) },
  { prefix: '/knowledge-base', load: () => import('../../knowledge-base/knowledge-base.module').then((m) => m.KnowledgeBaseModule) },
];

/** Replaceable in tests, so a spec never has to load real feature modules. */
export const ONBOARDING_AREAS = new InjectionToken<OnboardingArea[]>('ONBOARDING_AREAS', {
  providedIn: 'root',
  factory: () => DEFAULT_AREAS,
});

/** The area a path belongs to (longest prefix wins) and the path segments after its prefix. */
export function areaFor(areas: OnboardingArea[], url: string): { area: OnboardingArea; rest: string[] } | null {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const area = areas
    .filter((a) => path === a.prefix || path.startsWith(a.prefix + '/'))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!area) {
    return null;
  }
  const rest = path.slice(area.prefix.length).split('/').filter(Boolean);
  return { area, rest };
}

/** The route (with a component) that `segments` select, and the `:param` values they carry. */
export function matchRoute(routes: Route[], segments: string[]): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (!route.component || route.path === undefined || route.path === '**') {
      continue;
    }
    const parts = route.path === '' ? [] : route.path.split('/');
    if (parts.length !== segments.length) {
      continue;
    }
    const params: Record<string, string> = {};
    const matches = parts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(segments[i]);
        return true;
      }
      return part === segments[i];
    });
    if (matches) {
      return { route, params };
    }
  }
  return null;
}

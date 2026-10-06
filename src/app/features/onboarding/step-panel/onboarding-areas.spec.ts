import { Component } from '@angular/core';

import { OnboardingArea, areaFor, matchRoute } from './onboarding-areas';

@Component({ template: '' })
class ListComponent {}

@Component({ template: '' })
class DetailComponent {}

const areas: OnboardingArea[] = ['/lead-discovery', '/campaigns', '/profile'].map((prefix) => ({ prefix, load: () => Promise.resolve(class {}) }));

describe('onboarding areas', () => {
  it('finds the area a URL belongs to and what follows its prefix', () => {
    expect(areaFor(areas, '/campaigns/42/history?tab=1')?.rest).toEqual(['42', 'history']);
    expect(areaFor(areas, '/lead-discovery/profile')?.area.prefix).toBe('/lead-discovery');
    expect(areaFor(areas, '/campaigns/')?.rest).toEqual([]);
  });

  it('does not mistake a longer word, or another module, for an area', () => {
    expect(areaFor(areas, '/campaigns-archive')).toBeNull();
    expect(areaFor(areas, '/account/profile')).toBeNull();
    expect(areaFor(areas, '/dashboard')).toBeNull();
  });

  it("picks the route a module's own table would, with its parameters", () => {
    const routes = [
      { path: '', component: ListComponent },
      { path: ':id', component: DetailComponent },
      { path: ':id/history', component: ListComponent },
      { path: 'lazy', loadChildren: () => Promise.resolve(class {}) },
    ];

    expect(matchRoute(routes, [])?.route.component).toBe(ListComponent);
    expect(matchRoute(routes, ['42'])).toEqual({ route: routes[1], params: { id: '42' } });
    expect(matchRoute(routes, ['42', 'history'])?.params).toEqual({ id: '42' });
    expect(matchRoute(routes, ['lazy', 'x'])).toBeNull();
  });
});

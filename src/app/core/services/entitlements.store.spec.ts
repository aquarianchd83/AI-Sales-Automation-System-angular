import { EntitlementsStore } from './entitlements.store';
import { Entitlements, FeatureTrial } from '../models/wallet.model';

describe('EntitlementsStore read-only access', () => {
  const trial = (used: number, freeUses = 10): FeatureTrial => ({
    feature: 'LeadDiscovery',
    label: 'Lead discovery',
    freeUses,
    used,
    remaining: Math.max(0, freeUses - used),
    exhausted: used >= freeUses,
    unit: 'leads',
    unitSingular: 'lead',
  });

  function store(features: Entitlements['features'], trials: FeatureTrial[]): EntitlementsStore {
    const s = new EntitlementsStore();
    s.set({ planCode: 'trial', planName: 'Basic', features, balance: 0, costs: [], trials } as Entitlements);
    return s;
  }

  it('keeps a feature with free uses left usable, not read-only', () => {
    const s = store(['LeadDiscovery'], [trial(3)]);
    expect(s.has('LeadDiscovery')).toBeTrue();
    expect(s.canView('LeadDiscovery')).toBeTrue();
    expect(s.usedUp('LeadDiscovery')).toBeNull();
  });

  it('opens a feature read-only once its free uses are used up', () => {
    const s = store([], [trial(10)]);
    expect(s.has('LeadDiscovery')).toBeFalse();
    expect(s.canView('LeadDiscovery')).toBeTrue();
    expect(s.usedUp('LeadDiscovery')?.used).toBe(10);
  });

  it('keeps a feature with no free uses at all locked', () => {
    const s = store([], []);
    expect(s.canView('ContentStudio')).toBeFalse();
    expect(s.usedUp('ContentStudio')).toBeNull();
  });
});

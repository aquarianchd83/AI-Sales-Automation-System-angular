import { cityGroupsFor, cityValue, countryName, filterCityGroups, hasCities } from './city-catalog';

describe('city catalog', () => {
  const COUNTRIES = ['IN', 'US', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'CA', 'AU', 'AE', 'SG'];

  it('has cities for every country the platform sells in', () => {
    for (const code of COUNTRIES) {
      expect(hasCities(code)).withContext(code).toBeTrue();
      expect(cityGroupsFor(code).length).withContext(code).toBeGreaterThan(2);
    }
  });

  it('is case-insensitive about the country and empty for one it does not know', () => {
    expect(cityGroupsFor('in').length).toBe(cityGroupsFor('IN').length);
    expect(cityGroupsFor('ZZ')).toEqual([]);
    expect(cityGroupsFor(null)).toEqual([]);
    expect(countryName('IN')).toBe('India');
    expect(countryName('ZZ')).toBeNull();
  });

  it('never repeats a saved location within a country, so two cities of one name stay apart', () => {
    for (const code of COUNTRIES) {
      const values = cityGroupsFor(code).flatMap((g) => g.cities.map((c) => c.value.toLowerCase()));
      expect(new Set(values).size).withContext(code).toBe(values.length);
    }
  });

  it('saves a city with its state, or alone when it is its own region', () => {
    expect(cityValue('Mohali', 'Punjab')).toBe('Mohali, Punjab');
    expect(cityValue('Chandigarh', 'Chandigarh')).toBe('Chandigarh');
    expect(cityValue('London', 'England - London')).toBe('London');
    expect(cityValue('Leeds', 'England - Yorkshire and the Humber')).toBe('Leeds, Yorkshire and the Humber');
  });

  it('lists a selection the catalog lacks in an "Already saved" group first', () => {
    const groups = cityGroupsFor('IN', ['Andheri West, Mumbai', 'Mohali, Punjab']);

    expect(groups[0].name).toBe('Already saved');
    expect(groups[0].cities.map((c) => c.value)).toEqual(['Andheri West, Mumbai']);
  });

  it('filters by city or state, keeping a whole state when its name matches', () => {
    const groups = cityGroupsFor('IN');

    expect(filterCityGroups(groups, '').length).toBe(groups.length);
    expect(filterCityGroups(groups, 'pune').map((g) => g.name)).toEqual(['Maharashtra']);
    expect(filterCityGroups(groups, 'goa')[0].cities.length).toBe(groups.find((g) => g.name === 'Goa')!.cities.length);
    expect(filterCityGroups(groups, 'zzzz')).toEqual([]);
  });
});

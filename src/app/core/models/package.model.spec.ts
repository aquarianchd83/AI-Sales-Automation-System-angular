import { formatPackageDuration, parseFeatureLines } from './package.model';

describe('package model helpers', () => {
  it('uses the singular unit for 1 and the plural otherwise', () => {
    expect(formatPackageDuration(1, 'Months')).toBe('1 Month');
    expect(formatPackageDuration(3, 'Months')).toBe('3 Months');
    expect(formatPackageDuration(1, 'Years')).toBe('1 Year');
  });

  it('splits features one per line, trimming and dropping blanks', () => {
    expect(parseFeatureLines(' SEO \n\n  Ads\n   \n')).toEqual(['SEO', 'Ads']);
    expect(parseFeatureLines('')).toEqual([]);
  });
});

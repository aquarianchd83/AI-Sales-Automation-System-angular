import { formatOptionLines, parseOptionLines, slugifyOptionValue } from './setup-options';

describe('setup option lines', () => {
  it('derives a stable value from a plain label', () => {
    expect(slugifyOptionValue('  Small & Medium Businesses ')).toBe('small_medium_businesses');
    expect(slugifyOptionValue('X (Twitter)')).toBe('x_twitter');
  });

  it('reads "label" and "value | label" lines, skipping blanks and repeated values', () => {
    expect(parseOptionLines('Instagram\n\n ig | Instagram again \nFacebook\ninstagram\n |\n')).toEqual([
      { value: 'instagram', label: 'Instagram' },
      { value: 'ig', label: 'Instagram again' },
      { value: 'facebook', label: 'Facebook' },
    ]);
  });

  it('round-trips, using the short form only when the value is the label slug', () => {
    const options = [
      { value: 'instagram', label: 'Instagram' },
      { value: 'yes', label: 'Yes, please' },
    ];
    const text = formatOptionLines(options);

    expect(text).toBe('Instagram\nyes | Yes, please');
    expect(parseOptionLines(text)).toEqual(options);
  });
});

import { CATEGORIES_WITH_OWN_SCREEN } from './settings.model';

describe('CATEGORIES_WITH_OWN_SCREEN', () => {
  it('keeps the Integrations settings off the General page, since they are set on the Integrations page', () => {
    expect(CATEGORIES_WITH_OWN_SCREEN).toContain('Integrations');
  });
});

import { TEMPLATE_CATEGORIES, templateCategoryInfo } from './message-template.model';

describe('template category info', () => {
  it('has an intro for every category and looks a category up safely', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      const info = templateCategoryInfo(category);
      expect(info).withContext(category).not.toBeNull();
      expect(info!.summary.length).toBeGreaterThan(10);
      expect(info!.goodFor.length).toBeGreaterThan(0);
    }
    expect(templateCategoryInfo('Something else')).toBeNull();
  });
});

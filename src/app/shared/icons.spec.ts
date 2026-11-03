import { CATEGORY_ICONS } from '../core/models/category-palette';
import { DEFAULT_CATEGORIES } from '../core/services/default-categories';

import { APP_ICONS } from './icons';

describe('APP_ICONS', () => {
  it('contains every icon a category can use', () => {
    for (const icon of CATEGORY_ICONS) {
      expect(APP_ICONS).toHaveProperty(icon);
    }
  });

  it('contains the icons of the default categories', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(APP_ICONS).toHaveProperty(category.icon);
    }
  });
});

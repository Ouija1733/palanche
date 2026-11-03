import type { CategoryColor } from './category-palette';

/** Expense categories apply to expenses, income categories to income. */
export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: string;
  /** Parent category for subcategories; at most two levels. */
  parentId: string | null;
  name: string;
  kind: CategoryKind;
  /** Ionicons name (-outline). Subcategories carry a copy of their parent's. */
  icon: string;
  /** Palette key. Subcategories carry a copy of their parent's. */
  color: CategoryColor;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type NewCategory = Pick<Category, 'name' | 'kind' | 'icon' | 'color'> &
  Partial<Pick<Category, 'parentId' | 'sortOrder'>>;

/** Fields that can be changed with `update()`. The parent changes through `setParent()`. */
export type CategoryChanges = Partial<Pick<Category, 'name' | 'icon' | 'color' | 'sortOrder'>>;

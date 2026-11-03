import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { Category, CategoryKind } from '../models/category';
import type { CategoryColor } from '../models/category-palette';
import { CategoriesRepository } from '../repositories/categories.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';
import { addDays, today } from '../utils/dates';

import { DomainError } from './domain-error';

/** A main category with its subcategories. */
export interface CategoryNode {
  category: Category;
  children: Category[];
}

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  /** Ignored for subcategories, which inherit the parent's. */
  icon: string;
  /** Ignored for subcategories, which inherit the parent's. */
  color: CategoryColor;
  parentId?: string | null;
}

/** How far back "most used" looks. */
const USAGE_WINDOW_DAYS = 90;

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new DomainError('INVALID_NAME', 'Category name cannot be empty');
  }
  return trimmed;
}

/**
 * Category rules: at most two levels, subcategories share kind, icon and color
 * with their parent, a category in use is merged rather than deleted.
 */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly database = inject(DatabaseService);
  private readonly categories = inject(CategoriesRepository);
  private readonly transactions = inject(TransactionsRepository);

  /** Main categories of a kind, each with its subcategories, in display order. */
  async getTree(kind: CategoryKind): Promise<CategoryNode[]> {
    const all = await this.categories.findAll({ kind });
    return all
      .filter((category) => category.parentId === null)
      .map((category) => ({ category, children: all.filter((child) => child.parentId === category.id) }));
  }

  async create(input: CategoryInput): Promise<Category> {
    const name = cleanName(input.name);
    return this.database.db.transaction(async (tx) => {
      if (!input.parentId) {
        return this.categories.create({ name, kind: input.kind, icon: input.icon, color: input.color }, tx);
      }
      const parent = await this.requireCategory(input.parentId, tx);
      this.assertCanBeParent(parent, input.kind);
      return this.categories.create(
        { name, kind: parent.kind, icon: parent.icon, color: parent.color, parentId: parent.id },
        tx,
      );
    });
  }

  /**
   * Renames a category; for a main category also changes icon and color and
   * copies them to its subcategories. Subcategories ignore icon and color.
   */
  async update(id: string, changes: { name?: string; icon?: string; color?: CategoryColor }): Promise<Category> {
    const name = changes.name === undefined ? undefined : cleanName(changes.name);
    return this.database.db.transaction(async (tx) => {
      const category = await this.requireCategory(id, tx);
      if (category.parentId) {
        return this.categories.update(id, { name }, tx);
      }
      const updated = await this.categories.update(id, { name, icon: changes.icon, color: changes.color }, tx);
      await this.categories.setChildrenAppearance(id, { icon: updated.icon, color: updated.color }, tx);
      return updated;
    });
  }

  /**
   * Moves a category under another main category of the same kind, or to the
   * top level with `null`. A category with subcategories cannot become one.
   */
  async move(id: string, newParentId: string | null): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const category = await this.requireCategory(id, tx);
      if (newParentId === null) {
        await this.categories.setParent(id, null, tx);
        return;
      }
      if (newParentId === id) {
        throw new DomainError('CATEGORY_SAME', 'A category cannot contain itself');
      }
      const parent = await this.requireCategory(newParentId, tx);
      this.assertCanBeParent(parent, category.kind);
      if ((await this.categories.findChildren(id, tx)).length > 0) {
        throw new DomainError('CATEGORY_TOO_DEEP', 'A category with subcategories cannot become a subcategory');
      }
      await this.categories.setParent(id, parent.id, tx);
      await this.categories.update(id, { icon: parent.icon, color: parent.color }, tx);
    });
  }

  /**
   * Merges `sourceId` into `targetId`: its transactions move to the target,
   * its subcategories move under the target (which must then be a main
   * category), and the source is deleted. All or nothing.
   */
  async merge(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) {
      throw new DomainError('CATEGORY_SAME', 'Cannot merge a category into itself');
    }
    await this.database.db.transaction(async (tx) => {
      const source = await this.requireCategory(sourceId, tx);
      const target = await this.requireCategory(targetId, tx);
      if (source.kind !== target.kind) {
        throw new DomainError('CATEGORY_KIND_MISMATCH', 'Categories of different kinds cannot be merged');
      }
      const children = await this.categories.findChildren(sourceId, tx);
      if (target.parentId === sourceId) {
        throw new DomainError('CATEGORY_SAME', 'Cannot merge a category into one of its subcategories');
      }
      if (children.length > 0 && target.parentId !== null) {
        throw new DomainError('CATEGORY_TOO_DEEP', 'Subcategories can only move under a main category');
      }

      await this.transactions.reassignCategory(sourceId, targetId, tx);
      for (const child of children) {
        await this.categories.setParent(child.id, targetId, tx);
        await this.categories.update(child.id, { icon: target.icon, color: target.color }, tx);
      }
      await this.categories.softDelete(sourceId, tx);
    });
  }

  /** Deletes an unused category without subcategories; otherwise propose a merge. */
  async delete(id: string): Promise<void> {
    await this.requireCategory(id);
    if ((await this.categories.findChildren(id)).length > 0) {
      throw new DomainError('CATEGORY_HAS_CHILDREN', 'Delete or move the subcategories first');
    }
    if ((await this.transactions.countByCategory(id)) > 0) {
      throw new DomainError('CATEGORY_IN_USE', 'A category with transactions can only be merged');
    }
    await this.categories.softDelete(id);
  }

  async restore(id: string): Promise<void> {
    await this.categories.restore(id);
  }

  /**
   * Categories for the quick grid: the most used of the last 90 days (main or
   * sub), then main categories in display order to fill the remaining places.
   */
  async getMostUsed(kind: CategoryKind, limit: number, now: Date = new Date()): Promise<Category[]> {
    const [all, usage] = await Promise.all([
      this.categories.findAll({ kind }),
      this.transactions.countByCategorySince(addDays(today(now), -USAGE_WINDOW_DAYS)),
    ]);
    const used = all
      .filter((category) => (usage.get(category.id) ?? 0) > 0)
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
    const fillers = all.filter((category) => category.parentId === null && !used.includes(category));
    return [...used, ...fillers].slice(0, limit);
  }

  private async requireCategory(id: string, db = this.database.db): Promise<Category> {
    const category = await this.categories.findById(id, db);
    if (!category) {
      throw new DomainError('CATEGORY_NOT_FOUND', `Category not found: ${id}`);
    }
    return category;
  }

  private assertCanBeParent(parent: Category, kind: CategoryKind): void {
    if (parent.parentId !== null) {
      throw new DomainError('CATEGORY_TOO_DEEP', 'Categories have at most two levels');
    }
    if (parent.kind !== kind) {
      throw new DomainError('CATEGORY_KIND_MISMATCH', 'A subcategory must have the kind of its parent');
    }
  }
}

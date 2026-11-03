import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { SqlExecutor } from '../db/sql-executor';
import type { Category, CategoryChanges, CategoryKind, NewCategory } from '../models/category';
import type { CategoryColor } from '../models/category-palette';
import { nowIso } from '../utils/dates';
import { uuidV4 } from '../utils/uuid';

import { buildAssignments } from './sql';

interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const COLUMNS = 'id, parent_id, name, kind, icon, color, sort_order, created_at, updated_at, deleted_at';

const UPDATABLE_COLUMNS = {
  name: 'name',
  icon: 'icon',
  color: 'color',
  sortOrder: 'sort_order',
} as const satisfies Record<keyof CategoryChanges, string>;

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    kind: row.kind,
    icon: row.icon,
    color: row.color as CategoryColor,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** The only place with SQL for the `categories` table. Deleted rows are never returned. */
@Injectable({ providedIn: 'root' })
export class CategoriesRepository {
  private readonly database = inject(DatabaseService);

  /** Active categories (main and sub), optionally of one kind, in display order. */
  async findAll(options: { kind?: CategoryKind } = {}, db: SqlExecutor = this.database.db): Promise<Category[]> {
    const kindFilter = options.kind ? 'AND kind = ?' : '';
    const rows = await db.query<CategoryRow>(
      `SELECT ${COLUMNS} FROM categories
       WHERE deleted_at IS NULL ${kindFilter}
       ORDER BY sort_order, name COLLATE NOCASE`,
      options.kind ? [options.kind] : [],
    );
    return rows.map(toCategory);
  }

  async findById(id: string, db: SqlExecutor = this.database.db): Promise<Category | null> {
    const [row] = await db.query<CategoryRow>(`SELECT ${COLUMNS} FROM categories WHERE id = ? AND deleted_at IS NULL`, [
      id,
    ]);
    return row ? toCategory(row) : null;
  }

  /** Active subcategories of a category. */
  async findChildren(parentId: string, db: SqlExecutor = this.database.db): Promise<Category[]> {
    const rows = await db.query<CategoryRow>(
      `SELECT ${COLUMNS} FROM categories
       WHERE parent_id = ? AND deleted_at IS NULL
       ORDER BY sort_order, name COLLATE NOCASE`,
      [parentId],
    );
    return rows.map(toCategory);
  }

  async create(input: NewCategory, db: SqlExecutor = this.database.db): Promise<Category> {
    const now = nowIso();
    const category: Category = {
      id: uuidV4(),
      parentId: input.parentId ?? null,
      name: input.name,
      kind: input.kind,
      icon: input.icon,
      color: input.color,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.run(`INSERT INTO categories (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      category.id,
      category.parentId,
      category.name,
      category.kind,
      category.icon,
      category.color,
      category.sortOrder,
      category.createdAt,
      category.updatedAt,
      category.deletedAt,
    ]);
    return category;
  }

  /** Changes the given fields and bumps updated_at. Throws if the category does not exist. */
  async update(id: string, changes: CategoryChanges, db: SqlExecutor = this.database.db): Promise<Category> {
    const { assignments, values } = buildAssignments(changes, UPDATABLE_COLUMNS);
    const { changes: updated } = await db.run(
      `UPDATE categories SET ${[...assignments, 'updated_at = ?'].join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      [...values, nowIso(), id],
    );
    const category = updated === 1 ? await this.findById(id, db) : null;
    if (!category) {
      throw new Error(`Category not found: ${id}`);
    }
    return category;
  }

  /** Moves a category under another one (or to the top level with `null`). */
  async setParent(id: string, parentId: string | null, db: SqlExecutor = this.database.db): Promise<void> {
    const { changes } = await db.run(
      'UPDATE categories SET parent_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [parentId, nowIso(), id],
    );
    if (changes !== 1) {
      throw new Error(`Category not found: ${id}`);
    }
  }

  /** Copies icon and color to all the active subcategories (they inherit them). */
  async setChildrenAppearance(
    parentId: string,
    appearance: { icon: string; color: CategoryColor },
    db: SqlExecutor = this.database.db,
  ): Promise<void> {
    await db.run(
      `UPDATE categories SET icon = ?, color = ?, updated_at = ?
       WHERE parent_id = ? AND deleted_at IS NULL AND (icon <> ? OR color <> ?)`,
      [appearance.icon, appearance.color, nowIso(), parentId, appearance.icon, appearance.color],
    );
  }

  async softDelete(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const now = nowIso();
    const { changes } = await db.run(
      'UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    return changes === 1;
  }

  async restore(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const { changes } = await db.run(
      'UPDATE categories SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL',
      [nowIso(), id],
    );
    return changes === 1;
  }
}

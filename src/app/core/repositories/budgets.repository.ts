import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { SqlExecutor, SqlValue } from '../db/sql-executor';
import type { Budget, NewBudget } from '../models/budget';
import type { YearMonth } from '../utils/dates';
import { nowIso } from '../utils/dates';
import { uuidV4 } from '../utils/uuid';

import { placeholders, upsertRows } from './sql';

interface BudgetRow {
  id: string;
  category_id: string | null;
  month: string;
  amount_cents: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const COLUMN_LIST = ['id', 'category_id', 'month', 'amount_cents', 'created_at', 'updated_at', 'deleted_at'] as const;
const COLUMNS = COLUMN_LIST.join(', ');
const B_COLUMNS = COLUMN_LIST.map((column) => `b.${column}`).join(', ');

function toBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    month: row.month,
    amountCents: row.amount_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toValues(budget: Budget): SqlValue[] {
  return [
    budget.id,
    budget.categoryId,
    budget.month,
    budget.amountCents,
    budget.createdAt,
    budget.updatedAt,
    budget.deletedAt,
  ];
}

/**
 * The only place with SQL for the `budgets` table. At most one active budget
 * per category and month (a unique index enforces it); the total budget of
 * the month has category_id NULL.
 */
@Injectable({ providedIn: 'root' })
export class BudgetsRepository {
  private readonly database = inject(DatabaseService);

  /**
   * Active budgets of the month. Budgets of deleted categories are left out
   * (they come back if the category is restored).
   */
  async findByMonth(month: YearMonth, db: SqlExecutor = this.database.db): Promise<Budget[]> {
    const rows = await db.query<BudgetRow>(
      `SELECT ${B_COLUMNS} FROM budgets b
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.deleted_at IS NULL AND b.month = ? AND (b.category_id IS NULL OR c.deleted_at IS NULL)
       ORDER BY b.created_at, b.id`,
      [month],
    );
    return rows.map(toBudget);
  }

  async findById(id: string, db: SqlExecutor = this.database.db): Promise<Budget | null> {
    const [row] = await db.query<BudgetRow>(`SELECT ${COLUMNS} FROM budgets WHERE id = ? AND deleted_at IS NULL`, [id]);
    return row ? toBudget(row) : null;
  }

  /** The active budget of a category (null = total) in a month, if any. */
  async findOne(
    month: YearMonth,
    categoryId: string | null,
    db: SqlExecutor = this.database.db,
  ): Promise<Budget | null> {
    const [row] = await db.query<BudgetRow>(
      `SELECT ${COLUMNS} FROM budgets
       WHERE deleted_at IS NULL AND month = ? AND IFNULL(category_id, '') = IFNULL(?, '')`,
      [month, categoryId],
    );
    return row ? toBudget(row) : null;
  }

  async create(input: NewBudget, db: SqlExecutor = this.database.db): Promise<Budget> {
    const now = nowIso();
    const budget: Budget = {
      id: uuidV4(),
      categoryId: input.categoryId,
      month: input.month,
      amountCents: input.amountCents,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.run(`INSERT INTO budgets (${COLUMNS}) VALUES (${placeholders(COLUMN_LIST.length)})`, toValues(budget));
    return budget;
  }

  /** Changes the amount and bumps updated_at. Throws if the budget does not exist. */
  async updateAmount(id: string, amountCents: number, db: SqlExecutor = this.database.db): Promise<Budget> {
    const { changes } = await db.run(
      'UPDATE budgets SET amount_cents = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [amountCents, nowIso(), id],
    );
    const budget = changes === 1 ? await this.findById(id, db) : null;
    if (!budget) {
      throw new Error(`Budget not found: ${id}`);
    }
    return budget;
  }

  /** Marks the budget as deleted. Returns false if it was not found or already deleted. */
  async softDelete(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const now = nowIso();
    const { changes } = await db.run(
      'UPDATE budgets SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    return changes === 1;
  }

  /** Undoes a soft delete. Returns false if there was nothing to restore. */
  async restore(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const { changes } = await db.run(
      'UPDATE budgets SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL',
      [nowIso(), id],
    );
    return changes === 1;
  }

  // Backup: whole table, deleted rows included, ids and timestamps preserved.

  async findAllIncludingDeleted(db: SqlExecutor = this.database.db): Promise<Budget[]> {
    const rows = await db.query<BudgetRow>(`SELECT ${COLUMNS} FROM budgets ORDER BY created_at, id`);
    return rows.map(toBudget);
  }

  async upsertAll(budgets: readonly Budget[], db: SqlExecutor = this.database.db): Promise<void> {
    await upsertRows(db, 'budgets', COLUMN_LIST, budgets.map(toValues));
  }

  /** Physically empties the table: only for "replace everything" restores. */
  async deleteAll(db: SqlExecutor = this.database.db): Promise<void> {
    await db.run('DELETE FROM budgets');
  }
}

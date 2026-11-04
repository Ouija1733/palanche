import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { SqlExecutor, SqlValue } from '../db/sql-executor';
import type { NewSavingsGoal, SavingsGoal, SavingsGoalChanges } from '../models/savings-goal';
import { nowIso } from '../utils/dates';
import { uuidV4 } from '../utils/uuid';

import { buildAssignments, placeholders, upsertRows } from './sql';

interface SavingsGoalRow {
  id: string;
  name: string;
  target_cents: number;
  target_date: string | null;
  account_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const COLUMN_LIST = [
  'id',
  'name',
  'target_cents',
  'target_date',
  'account_id',
  'sort_order',
  'created_at',
  'updated_at',
  'deleted_at',
] as const;
const COLUMNS = COLUMN_LIST.join(', ');

/** Model field → column, for the fields that `update()` may change. */
const UPDATABLE_COLUMNS = {
  name: 'name',
  targetCents: 'target_cents',
  targetDate: 'target_date',
  accountId: 'account_id',
  sortOrder: 'sort_order',
} as const satisfies Record<keyof SavingsGoalChanges, string>;

function toSavingsGoal(row: SavingsGoalRow): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    targetCents: row.target_cents,
    targetDate: row.target_date,
    accountId: row.account_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toValues(goal: SavingsGoal): SqlValue[] {
  return [
    goal.id,
    goal.name,
    goal.targetCents,
    goal.targetDate,
    goal.accountId,
    goal.sortOrder,
    goal.createdAt,
    goal.updatedAt,
    goal.deletedAt,
  ];
}

/** The only place with SQL for the `savings_goals` table. */
@Injectable({ providedIn: 'root' })
export class SavingsGoalsRepository {
  private readonly database = inject(DatabaseService);

  /** Active goals in display order. */
  async findAll(db: SqlExecutor = this.database.db): Promise<SavingsGoal[]> {
    const rows = await db.query<SavingsGoalRow>(
      `SELECT ${COLUMNS} FROM savings_goals WHERE deleted_at IS NULL
       ORDER BY sort_order, name COLLATE NOCASE`,
    );
    return rows.map(toSavingsGoal);
  }

  async findById(id: string, db: SqlExecutor = this.database.db): Promise<SavingsGoal | null> {
    const [row] = await db.query<SavingsGoalRow>(
      `SELECT ${COLUMNS} FROM savings_goals WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row ? toSavingsGoal(row) : null;
  }

  async create(input: NewSavingsGoal, db: SqlExecutor = this.database.db): Promise<SavingsGoal> {
    const now = nowIso();
    const goal: SavingsGoal = {
      id: uuidV4(),
      name: input.name,
      targetCents: input.targetCents,
      targetDate: input.targetDate,
      accountId: input.accountId,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.run(`INSERT INTO savings_goals (${COLUMNS}) VALUES (${placeholders(COLUMN_LIST.length)})`, toValues(goal));
    return goal;
  }

  /** Changes the given fields and bumps updated_at. Throws if the goal does not exist. */
  async update(id: string, changes: SavingsGoalChanges, db: SqlExecutor = this.database.db): Promise<SavingsGoal> {
    const { assignments, values } = buildAssignments(changes, UPDATABLE_COLUMNS);
    const { changes: updated } = await db.run(
      `UPDATE savings_goals SET ${[...assignments, 'updated_at = ?'].join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      [...values, nowIso(), id],
    );
    const goal = updated === 1 ? await this.findById(id, db) : null;
    if (!goal) {
      throw new Error(`Savings goal not found: ${id}`);
    }
    return goal;
  }

  /** Marks the goal as deleted. Returns false if it was not found or already deleted. */
  async softDelete(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const now = nowIso();
    const { changes } = await db.run(
      'UPDATE savings_goals SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    return changes === 1;
  }

  /** Undoes a soft delete. Returns false if there was nothing to restore. */
  async restore(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const { changes } = await db.run(
      'UPDATE savings_goals SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL',
      [nowIso(), id],
    );
    return changes === 1;
  }

  // Backup: whole table, deleted rows included, ids and timestamps preserved.

  async findAllIncludingDeleted(db: SqlExecutor = this.database.db): Promise<SavingsGoal[]> {
    const rows = await db.query<SavingsGoalRow>(`SELECT ${COLUMNS} FROM savings_goals ORDER BY created_at, id`);
    return rows.map(toSavingsGoal);
  }

  async upsertAll(goals: readonly SavingsGoal[], db: SqlExecutor = this.database.db): Promise<void> {
    await upsertRows(db, 'savings_goals', COLUMN_LIST, goals.map(toValues));
  }

  /** Physically empties the table: only for "replace everything" restores. */
  async deleteAll(db: SqlExecutor = this.database.db): Promise<void> {
    await db.run('DELETE FROM savings_goals');
  }
}

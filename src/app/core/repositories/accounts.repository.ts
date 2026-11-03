import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { SqlExecutor } from '../db/sql-executor';
import type { Account, AccountChanges, AccountType, NewAccount } from '../models/account';
import { nowIso } from '../utils/dates';
import { uuidV4 } from '../utils/uuid';

import { buildAssignments } from './sql';

/** Row as stored in SQLite (snake_case, booleans as 0/1). */
interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_cents: number;
  archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const COLUMNS = `id, name, type, currency, initial_balance_cents, archived, sort_order,
  created_at, updated_at, deleted_at`;

/** Model field → column, for the fields that `update()` may change. */
const UPDATABLE_COLUMNS = {
  name: 'name',
  type: 'type',
  currency: 'currency',
  initialBalanceCents: 'initial_balance_cents',
  archived: 'archived',
  sortOrder: 'sort_order',
} as const satisfies Record<keyof AccountChanges, string>;

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    initialBalanceCents: row.initial_balance_cents,
    archived: row.archived === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * The only place with SQL for the `accounts` table. Deleted rows (deleted_at
 * set) are never returned: deleting is a soft delete that `restore()` can undo.
 *
 * Every method takes an optional `db`: services pass the `tx` of a transaction
 * to combine several repositories in one atomic operation.
 */
@Injectable({ providedIn: 'root' })
export class AccountsRepository {
  private readonly database = inject(DatabaseService);

  /** Active accounts in display order; archived ones only if requested. */
  async findAll(options: { includeArchived?: boolean } = {}, db: SqlExecutor = this.database.db): Promise<Account[]> {
    const archivedFilter = options.includeArchived ? '' : 'AND archived = 0';
    const rows = await db.query<AccountRow>(
      `SELECT ${COLUMNS} FROM accounts
       WHERE deleted_at IS NULL ${archivedFilter}
       ORDER BY sort_order, name COLLATE NOCASE`,
    );
    return rows.map(toAccount);
  }

  async findById(id: string, db: SqlExecutor = this.database.db): Promise<Account | null> {
    const [row] = await db.query<AccountRow>(`SELECT ${COLUMNS} FROM accounts WHERE id = ? AND deleted_at IS NULL`, [
      id,
    ]);
    return row ? toAccount(row) : null;
  }

  async create(input: NewAccount, db: SqlExecutor = this.database.db): Promise<Account> {
    const now = nowIso();
    const account: Account = {
      id: uuidV4(),
      name: input.name,
      type: input.type,
      currency: input.currency ?? 'EUR',
      initialBalanceCents: input.initialBalanceCents ?? 0,
      archived: false,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.run(`INSERT INTO accounts (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      account.id,
      account.name,
      account.type,
      account.currency,
      account.initialBalanceCents,
      Number(account.archived),
      account.sortOrder,
      account.createdAt,
      account.updatedAt,
      account.deletedAt,
    ]);
    return account;
  }

  /** Changes the given fields and bumps updated_at. Throws if the account does not exist. */
  async update(id: string, changes: AccountChanges, db: SqlExecutor = this.database.db): Promise<Account> {
    const { assignments, values } = buildAssignments(changes, UPDATABLE_COLUMNS);
    const { changes: updated } = await db.run(
      `UPDATE accounts SET ${[...assignments, 'updated_at = ?'].join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      [...values, nowIso(), id],
    );
    const account = updated === 1 ? await this.findById(id, db) : null;
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }
    return account;
  }

  /** Marks the account as deleted. Returns false if it was not found or already deleted. */
  async softDelete(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const now = nowIso();
    const { changes } = await db.run(
      'UPDATE accounts SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    return changes === 1;
  }

  /** Undoes a soft delete (the "Annulla" of the toast). Returns false if there was nothing to restore. */
  async restore(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const { changes } = await db.run(
      'UPDATE accounts SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL',
      [nowIso(), id],
    );
    return changes === 1;
  }
}

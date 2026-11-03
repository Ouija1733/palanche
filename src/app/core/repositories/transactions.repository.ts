import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { SqlExecutor, SqlValue } from '../db/sql-executor';
import type { CategoryColor } from '../models/category-palette';
import type {
  AccountMovements,
  NewTransaction,
  Transaction,
  TransactionChanges,
  TransactionFilter,
  TransactionListItem,
  TransactionSummary,
} from '../models/transaction';
import type { TransactionType } from '../models/transaction-type';
import type { IsoDate } from '../utils/dates';
import { nowIso } from '../utils/dates';
import { uuidV4 } from '../utils/uuid';

import { buildAssignments, likeContains, placeholders, upsertRows } from './sql';

interface TransactionRow {
  id: string;
  type: TransactionType;
  amount_cents: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  date: string;
  payee: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface TransactionListRow extends TransactionRow {
  account_name: string;
  to_account_name: string | null;
  category_name: string | null;
  parent_category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  tag_names: string | null;
}

const COLUMN_LIST = [
  'id',
  'type',
  'amount_cents',
  'account_id',
  'to_account_id',
  'category_id',
  'date',
  'payee',
  'note',
  'created_at',
  'updated_at',
  'deleted_at',
] as const;
const COLUMNS = COLUMN_LIST.join(', ');

const UPDATABLE_COLUMNS = {
  type: 'type',
  amountCents: 'amount_cents',
  accountId: 'account_id',
  toAccountId: 'to_account_id',
  categoryId: 'category_id',
  date: 'date',
  payee: 'payee',
  note: 'note',
} as const satisfies Record<keyof TransactionChanges, string>;

/** ASCII "unit separator": cannot appear in a tag name typed by the user. */
const TAG_SEPARATOR = '\u001f';

/** Net effect on the user's money: income +, expense −, transfers 0. */
const NET_AMOUNT_SQL = `CASE t.type WHEN 'income' THEN t.amount_cents WHEN 'expense' THEN -t.amount_cents ELSE 0 END`;

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountCents: row.amount_cents,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    date: row.date,
    payee: row.payee,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** Values in COLUMN_LIST order. */
function toValues(transaction: Transaction): SqlValue[] {
  return [
    transaction.id,
    transaction.type,
    transaction.amountCents,
    transaction.accountId,
    transaction.toAccountId,
    transaction.categoryId,
    transaction.date,
    transaction.payee,
    transaction.note,
    transaction.createdAt,
    transaction.updatedAt,
    transaction.deletedAt,
  ];
}

function toListItem(row: TransactionListRow): TransactionListItem {
  return {
    ...toTransaction(row),
    accountName: row.account_name,
    toAccountName: row.to_account_name,
    categoryName: row.category_name,
    parentCategoryName: row.parent_category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color as CategoryColor | null,
    tags: row.tag_names
      ? row.tag_names.split(TAG_SEPARATOR).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
      : [],
  };
}

/** WHERE clause (on alias `t`) for the active transactions matching a filter. */
function buildWhere(filter: TransactionFilter): { where: string; params: SqlValue[] } {
  const conditions = ['t.deleted_at IS NULL'];
  const params: SqlValue[] = [];

  if (filter.from) {
    conditions.push('t.date >= ?');
    params.push(filter.from);
  }
  if (filter.to) {
    conditions.push('t.date <= ?');
    params.push(filter.to);
  }
  if (filter.accountIds?.length) {
    const list = placeholders(filter.accountIds.length);
    conditions.push(`(t.account_id IN (${list}) OR t.to_account_id IN (${list}))`);
    params.push(...filter.accountIds, ...filter.accountIds);
  }
  if (filter.categoryIds?.length) {
    const list = placeholders(filter.categoryIds.length);
    conditions.push(
      `(t.category_id IN (${list}) OR t.category_id IN (SELECT id FROM categories WHERE parent_id IN (${list})))`,
    );
    params.push(...filter.categoryIds, ...filter.categoryIds);
  }
  if (filter.types?.length) {
    conditions.push(`t.type IN (${placeholders(filter.types.length)})`);
    params.push(...filter.types);
  }
  if (filter.tagIds?.length) {
    conditions.push(
      `EXISTS (SELECT 1 FROM transaction_tags tt
               WHERE tt.transaction_id = t.id AND tt.deleted_at IS NULL
                 AND tt.tag_id IN (${placeholders(filter.tagIds.length)}))`,
    );
    params.push(...filter.tagIds);
  }
  const text = filter.text?.trim();
  if (text) {
    conditions.push(`(t.note LIKE ? ESCAPE '\\' OR t.payee LIKE ? ESCAPE '\\')`);
    params.push(likeContains(text), likeContains(text));
  }
  return { where: conditions.join(' AND '), params };
}

/** The only place with SQL for the `transactions` table. Deleted rows are never returned. */
@Injectable({ providedIn: 'root' })
export class TransactionsRepository {
  private readonly database = inject(DatabaseService);

  async findById(id: string, db: SqlExecutor = this.database.db): Promise<Transaction | null> {
    const [row] = await db.query<TransactionRow>(
      `SELECT ${COLUMNS} FROM transactions WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row ? toTransaction(row) : null;
  }

  /**
   * Transactions matching the filter, newest first, with account and category
   * names, appearance and tags. `limit` / `offset` page through the results.
   */
  async search(
    filter: TransactionFilter = {},
    page: { limit?: number; offset?: number } = {},
    db: SqlExecutor = this.database.db,
  ): Promise<TransactionListItem[]> {
    const { where, params } = buildWhere(filter);
    const rows = await db.query<TransactionListRow>(
      `SELECT t.*,
         a.name AS account_name,
         ta.name AS to_account_name,
         c.name AS category_name,
         p.name AS parent_category_name,
         c.icon AS category_icon,
         c.color AS category_color,
         (SELECT group_concat(g.name, char(31))
            FROM transaction_tags tt JOIN tags g ON g.id = tt.tag_id
           WHERE tt.transaction_id = t.id AND tt.deleted_at IS NULL AND g.deleted_at IS NULL) AS tag_names
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN accounts ta ON ta.id = t.to_account_id
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       WHERE ${where}
       ORDER BY t.date DESC, t.created_at DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, page.limit ?? -1, page.offset ?? 0],
    );
    return rows.map(toListItem);
  }

  /** Count and net amount of all the transactions matching the filter. */
  async summarize(filter: TransactionFilter = {}, db: SqlExecutor = this.database.db): Promise<TransactionSummary> {
    const { where, params } = buildWhere(filter);
    const [row] = await db.query<{ count: number; net_cents: number }>(
      `SELECT COUNT(*) AS count, COALESCE(SUM(${NET_AMOUNT_SQL}), 0) AS net_cents
       FROM transactions t WHERE ${where}`,
      params,
    );
    return { count: row.count, netCents: row.net_cents };
  }

  /** Net amount per day for the filter (days without transactions are absent). */
  async netByDate(filter: TransactionFilter = {}, db: SqlExecutor = this.database.db): Promise<Map<IsoDate, number>> {
    const { where, params } = buildWhere(filter);
    const rows = await db.query<{ date: string; net_cents: number }>(
      `SELECT t.date, SUM(${NET_AMOUNT_SQL}) AS net_cents
       FROM transactions t WHERE ${where} GROUP BY t.date`,
      params,
    );
    return new Map(rows.map((row) => [row.date, row.net_cents]));
  }

  /** Totals of the active transactions per account, by direction, for balances. */
  async movementsByAccount(db: SqlExecutor = this.database.db): Promise<Map<string, AccountMovements>> {
    const result = new Map<string, AccountMovements>();
    const entry = (accountId: string): AccountMovements => {
      let movements = result.get(accountId);
      if (!movements) {
        movements = { incomeCents: 0, expenseCents: 0, transferOutCents: 0, transferInCents: 0 };
        result.set(accountId, movements);
      }
      return movements;
    };

    const outgoing = await db.query<{ account_id: string; type: TransactionType; total: number }>(
      `SELECT account_id, type, SUM(amount_cents) AS total FROM transactions
       WHERE deleted_at IS NULL GROUP BY account_id, type`,
    );
    for (const row of outgoing) {
      const movements = entry(row.account_id);
      if (row.type === 'income') movements.incomeCents = row.total;
      else if (row.type === 'expense') movements.expenseCents = row.total;
      else movements.transferOutCents = row.total;
    }

    const incoming = await db.query<{ to_account_id: string; total: number }>(
      `SELECT to_account_id, SUM(amount_cents) AS total FROM transactions
       WHERE deleted_at IS NULL AND type = 'transfer' GROUP BY to_account_id`,
    );
    for (const row of incoming) {
      entry(row.to_account_id).transferInCents = row.total;
    }
    return result;
  }

  /** Active transactions per category since a date, for the "most used" grid. */
  async countByCategorySince(since: IsoDate, db: SqlExecutor = this.database.db): Promise<Map<string, number>> {
    const rows = await db.query<{ category_id: string; count: number }>(
      `SELECT category_id, COUNT(*) AS count FROM transactions
       WHERE deleted_at IS NULL AND category_id IS NOT NULL AND date >= ?
       GROUP BY category_id`,
      [since],
    );
    return new Map(rows.map((row) => [row.category_id, row.count]));
  }

  /** Active transactions that use the account, as source or destination. */
  async countByAccount(accountId: string, db: SqlExecutor = this.database.db): Promise<number> {
    const [row] = await db.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE deleted_at IS NULL AND (account_id = ? OR to_account_id = ?)`,
      [accountId, accountId],
    );
    return row.count;
  }

  /** Active transactions that use the category (not its subcategories). */
  async countByCategory(categoryId: string, db: SqlExecutor = this.database.db): Promise<number> {
    const [row] = await db.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM transactions WHERE deleted_at IS NULL AND category_id = ?',
      [categoryId],
    );
    return row.count;
  }

  /**
   * Moves every transaction of a category to another one (used to merge
   * categories). Deleted rows are moved too, so undoing a deletion later
   * never points to the merged category.
   */
  async reassignCategory(fromId: string, toId: string, db: SqlExecutor = this.database.db): Promise<number> {
    const { changes } = await db.run('UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?', [
      toId,
      nowIso(),
      fromId,
    ]);
    return changes;
  }

  async create(input: NewTransaction, db: SqlExecutor = this.database.db): Promise<Transaction> {
    const now = nowIso();
    const transaction: Transaction = {
      id: uuidV4(),
      type: input.type,
      amountCents: input.amountCents,
      accountId: input.accountId,
      toAccountId: input.toAccountId ?? null,
      categoryId: input.categoryId ?? null,
      date: input.date,
      payee: input.payee ?? null,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.run(
      `INSERT INTO transactions (${COLUMNS}) VALUES (${placeholders(COLUMN_LIST.length)})`,
      toValues(transaction),
    );
    return transaction;
  }

  // Backup: whole table, deleted rows included, ids and timestamps preserved.

  async findAllIncludingDeleted(db: SqlExecutor = this.database.db): Promise<Transaction[]> {
    const rows = await db.query<TransactionRow>(`SELECT ${COLUMNS} FROM transactions ORDER BY created_at, id`);
    return rows.map(toTransaction);
  }

  async upsertAll(transactions: readonly Transaction[], db: SqlExecutor = this.database.db): Promise<void> {
    await upsertRows(db, 'transactions', COLUMN_LIST, transactions.map(toValues));
  }

  /** Physically empties the table: only for "replace everything" restores. */
  async deleteAll(db: SqlExecutor = this.database.db): Promise<void> {
    await db.run('DELETE FROM transactions');
  }

  /** Changes the given fields and bumps updated_at. Throws if the transaction does not exist. */
  async update(id: string, changes: TransactionChanges, db: SqlExecutor = this.database.db): Promise<Transaction> {
    const { assignments, values } = buildAssignments(changes, UPDATABLE_COLUMNS);
    const { changes: updated } = await db.run(
      `UPDATE transactions SET ${[...assignments, 'updated_at = ?'].join(', ')}
       WHERE id = ? AND deleted_at IS NULL`,
      [...values, nowIso(), id],
    );
    const transaction = updated === 1 ? await this.findById(id, db) : null;
    if (!transaction) {
      throw new Error(`Transaction not found: ${id}`);
    }
    return transaction;
  }

  async softDelete(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const now = nowIso();
    const { changes } = await db.run(
      'UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    return changes === 1;
  }

  async restore(id: string, db: SqlExecutor = this.database.db): Promise<boolean> {
    const { changes } = await db.run(
      'UPDATE transactions SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL',
      [nowIso(), id],
    );
    return changes === 1;
  }
}

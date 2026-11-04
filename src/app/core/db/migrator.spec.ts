import { createTestExecutor } from '../../../testing/sqljs-executor';

import type { Migration } from './migrations';
import { MIGRATIONS } from './migrations';
import { getSchemaVersion, migrate } from './migrator';
import type { SqlExecutor } from './sql-executor';

const NOW = '2026-11-03T10:00:00.000Z';

async function tableNames(db: SqlExecutor): Promise<string[]> {
  const rows = await db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((row) => row.name);
}

async function columnNames(db: SqlExecutor, table: string): Promise<string[]> {
  const rows = await db.query<{ name: string }>(`SELECT name FROM pragma_table_info('${table}')`);
  return rows.map((row) => row.name);
}

describe('migrate', () => {
  let db: SqlExecutor;

  beforeEach(async () => {
    db = await createTestExecutor();
  });

  it('creates all the tables on an empty database', async () => {
    expect(await migrate(db)).toEqual([1, 2]);
    expect(await tableNames(db)).toEqual([
      'accounts',
      'budgets',
      'categories',
      'savings_goals',
      'schema_migrations',
      'settings',
      'tags',
      'transaction_tags',
      'transactions',
    ]);
    expect(await getSchemaVersion(db)).toBe(2);
  });

  it('adds id and timestamp columns to every entity table', async () => {
    await migrate(db);
    for (const table of [
      'accounts',
      'categories',
      'transactions',
      'tags',
      'transaction_tags',
      'budgets',
      'savings_goals',
    ]) {
      expect(await columnNames(db, table)).toEqual(
        expect.arrayContaining(['id', 'created_at', 'updated_at', 'deleted_at']),
      );
    }
  });

  it('does nothing when the schema is already up to date', async () => {
    await migrate(db);
    expect(await migrate(db)).toEqual([]);
    const rows = await db.query('SELECT * FROM schema_migrations');
    expect(rows).toHaveLength(MIGRATIONS.length);
  });

  it('applies only the pending migrations and records them', async () => {
    const first: Migration = { version: 1, name: 'first', statements: ['CREATE TABLE a (id TEXT)'] };
    const second: Migration = { version: 2, name: 'second', statements: ['CREATE TABLE b (id TEXT)'] };

    await migrate(db, [first], () => NOW);
    expect(await migrate(db, [first, second], () => NOW)).toEqual([2]);
    expect(await db.query('SELECT version, name, applied_at FROM schema_migrations ORDER BY version')).toEqual([
      { version: 1, name: 'first', applied_at: NOW },
      { version: 2, name: 'second', applied_at: NOW },
    ]);
  });

  it('rolls back a failing migration completely', async () => {
    const broken: Migration = {
      version: 1,
      name: 'broken',
      statements: ['CREATE TABLE a (id TEXT)', 'THIS IS NOT SQL'],
    };

    await expect(migrate(db, [broken])).rejects.toThrow();
    expect(await tableNames(db)).toEqual(['schema_migrations']);
    expect(await getSchemaVersion(db)).toBe(0);
  });

  it('rejects migrations that are not numbered sequentially', async () => {
    const gap: Migration = { version: 2, name: 'gap', statements: [] };
    await expect(migrate(db, [gap])).rejects.toThrow(/without gaps/);
  });

  it('refuses a database created by a newer version of the app', async () => {
    await migrate(db);
    await expect(migrate(db, [])).rejects.toThrow(/newer than this app/);
  });
});

describe('migration 001 constraints', () => {
  let db: SqlExecutor;
  const ts = [NOW, NOW];

  beforeEach(async () => {
    db = await createTestExecutor();
    await migrate(db);
    await db.run(
      `INSERT INTO accounts (id, name, type, created_at, updated_at)
       VALUES ('a1', 'Conto corrente', 'checking', ?, ?), ('a2', 'Contanti', 'cash', ?, ?)`,
      [...ts, ...ts],
    );
  });

  const insertTransaction = (type: string, amount: number, toAccount: string | null = null, date = '2026-11-03') =>
    db.run(
      `INSERT INTO transactions (id, type, amount_cents, account_id, to_account_id, date, created_at, updated_at)
       VALUES (?, ?, ?, 'a1', ?, ?, ?, ?)`,
      [crypto.randomUUID(), type, amount, toAccount, date, ...ts],
    );

  it('accepts a valid expense and a valid transfer', async () => {
    await insertTransaction('expense', 1250);
    await insertTransaction('transfer', 5000, 'a2');
    expect(await db.query('SELECT id FROM transactions')).toHaveLength(2);
  });

  it.each([
    ['a zero amount', () => insertTransaction('expense', 0)],
    ['a negative amount', () => insertTransaction('expense', -100)],
    ['a decimal amount', () => insertTransaction('expense', 12.5)],
    ['an unknown type', () => insertTransaction('refund', 100)],
    ['a transfer without destination', () => insertTransaction('transfer', 100)],
    ['an expense with a destination', () => insertTransaction('expense', 100, 'a2')],
    ['a transfer to the same account', () => insertTransaction('transfer', 100, 'a1')],
    ['a missing destination account', () => insertTransaction('transfer', 100, 'nope')],
    ['a date with a time', () => insertTransaction('expense', 100, null, '2026-11-03T10:00')],
  ])('rejects %s', async (_label, insert) => {
    await expect(insert()).rejects.toThrow();
  });

  it('allows reusing a tag name once the old tag is deleted', async () => {
    await db.run(`INSERT INTO tags (id, name, created_at, updated_at) VALUES ('t1', 'Vacanze', ?, ?)`, ts);
    await expect(
      db.run(`INSERT INTO tags (id, name, created_at, updated_at) VALUES ('t2', 'vacanze', ?, ?)`, ts),
    ).rejects.toThrow();

    await db.run(`UPDATE tags SET deleted_at = ? WHERE id = 't1'`, [NOW]);
    await db.run(`INSERT INTO tags (id, name, created_at, updated_at) VALUES ('t2', 'vacanze', ?, ?)`, ts);
    expect(await db.query('SELECT id FROM tags WHERE deleted_at IS NULL')).toEqual([{ id: 't2' }]);
  });
});

describe('migration 002: budgets and savings goals', () => {
  let db: SqlExecutor;
  const ts = [NOW, NOW];

  beforeEach(async () => {
    db = await createTestExecutor();
    await migrate(db, MIGRATIONS.slice(0, 1));
    // A version 1 database with data, as on the phone before the update.
    await db.run(
      `INSERT INTO accounts (id, name, type, created_at, updated_at) VALUES ('a1', 'Risparmi', 'savings', ?, ?)`,
      ts,
    );
    await db.run(
      `INSERT INTO categories (id, name, kind, icon, color, created_at, updated_at)
       VALUES ('c1', 'Svago', 'expense', 'film-outline', 'pink', ?, ?)`,
      ts,
    );
    await db.run(
      `INSERT INTO transactions (id, type, amount_cents, account_id, category_id, date, created_at, updated_at)
       VALUES ('t1', 'expense', 1200, 'a1', 'c1', '2026-11-03', ?, ?)`,
      ts,
    );
    expect(await migrate(db)).toEqual([2]);
  });

  const insertBudget = (id: string, categoryId: string | null, month = '2026-11', amount = 10000) =>
    db.run(
      `INSERT INTO budgets (id, category_id, month, amount_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, categoryId, month, amount, ...ts],
    );

  it('keeps the existing data', async () => {
    expect(await db.query('SELECT id FROM transactions')).toEqual([{ id: 't1' }]);
    expect(await getSchemaVersion(db)).toBe(2);
  });

  it('allows one active budget per category and month, and one total', async () => {
    await insertBudget('b1', 'c1');
    await insertBudget('b2', null);
    await insertBudget('b3', 'c1', '2026-12');
    await expect(insertBudget('b4', 'c1')).rejects.toThrow();
    await expect(insertBudget('b5', null)).rejects.toThrow();

    // Once deleted, the slot can be used again.
    await db.run(`UPDATE budgets SET deleted_at = ? WHERE id = 'b1'`, [NOW]);
    await insertBudget('b4', 'c1');
    expect(await db.query('SELECT id FROM budgets WHERE deleted_at IS NULL ORDER BY id')).toHaveLength(3);
  });

  it.each([
    ['a zero amount', () => insertBudget('x', 'c1', '2026-11', 0)],
    ['a decimal amount', () => insertBudget('x', 'c1', '2026-11', 10.5)],
    ['a month with a day', () => insertBudget('x', 'c1', '2026-11-01')],
    ['a missing category', () => insertBudget('x', 'nope')],
  ])('rejects a budget with %s', async (_label, insert) => {
    await expect(insert()).rejects.toThrow();
  });

  const insertGoal = (targetCents: number, targetDate: string | null, accountId = 'a1') =>
    db.run(
      `INSERT INTO savings_goals (id, name, target_cents, target_date, account_id, created_at, updated_at)
       VALUES (?, 'Vacanze', ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), targetCents, targetDate, accountId, ...ts],
    );

  it('accepts goals with or without a date', async () => {
    await insertGoal(300000, '2027-06-30');
    await insertGoal(100000, null);
    expect(await db.query('SELECT id FROM savings_goals')).toHaveLength(2);
  });

  it.each([
    ['a zero target', () => insertGoal(0, null)],
    ['a date with a time', () => insertGoal(1000, '2027-06-30T10:00')],
    ['a missing account', () => insertGoal(1000, null, 'nope')],
  ])('rejects a goal with %s', async (_label, insert) => {
    await expect(insert()).rejects.toThrow();
  });
});

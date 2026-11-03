import { createTestExecutor } from '../../../testing/sqljs-executor';

import type { Migration } from './migrations';
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

  it('creates all the phase 1 tables on an empty database', async () => {
    expect(await migrate(db)).toEqual([1]);
    expect(await tableNames(db)).toEqual([
      'accounts',
      'categories',
      'schema_migrations',
      'settings',
      'tags',
      'transaction_tags',
      'transactions',
    ]);
    expect(await getSchemaVersion(db)).toBe(1);
  });

  it('adds id and timestamp columns to every entity table', async () => {
    await migrate(db);
    for (const table of ['accounts', 'categories', 'transactions', 'tags', 'transaction_tags']) {
      expect(await columnNames(db, table)).toEqual(
        expect.arrayContaining(['id', 'created_at', 'updated_at', 'deleted_at']),
      );
    }
  });

  it('does nothing when the schema is already up to date', async () => {
    await migrate(db);
    expect(await migrate(db)).toEqual([]);
    const rows = await db.query('SELECT * FROM schema_migrations');
    expect(rows).toHaveLength(1);
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

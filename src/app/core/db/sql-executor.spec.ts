import { createTestExecutor } from '../../../testing/sqljs-executor';

import type { SqlExecutor } from './sql-executor';

describe('BaseSqlExecutor transactions', () => {
  let db: SqlExecutor;

  const count = async (): Promise<number> => {
    const [row] = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM items');
    return row.n;
  };

  beforeEach(async () => {
    db = await createTestExecutor();
    await db.run('CREATE TABLE items (name TEXT NOT NULL)');
  });

  it('commits all the writes when the work succeeds', async () => {
    const result = await db.transaction(async (tx) => {
      await tx.run("INSERT INTO items VALUES ('a')");
      await tx.run("INSERT INTO items VALUES ('b')");
      return 'done';
    });
    expect(result).toBe('done');
    expect(await count()).toBe(2);
  });

  it('rolls back all the writes when the work throws', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.run("INSERT INTO items VALUES ('a')");
        await tx.run('INSERT INTO items VALUES (NULL)'); // violates NOT NULL
      }),
    ).rejects.toThrow();
    expect(await count()).toBe(0);
  });

  it('runs concurrent transactions one after the other', async () => {
    const order: string[] = [];
    const slow = db.transaction(async (tx) => {
      order.push('slow:start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await tx.run("INSERT INTO items VALUES ('slow')");
      order.push('slow:end');
    });
    const fast = db.transaction(async (tx) => {
      order.push('fast:start');
      await tx.run("INSERT INTO items VALUES ('fast')");
      order.push('fast:end');
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(['slow:start', 'slow:end', 'fast:start', 'fast:end']);
  });

  it('keeps working after a failed transaction', async () => {
    await expect(db.transaction(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await db.transaction((tx) => tx.run("INSERT INTO items VALUES ('a')"));
    expect(await count()).toBe(1);
  });

  it('rejects nested transactions on the tx executor', async () => {
    await expect(db.transaction((tx) => tx.transaction(async () => undefined))).rejects.toThrow(/Nested/);
  });

  it('reports the number of changed rows', async () => {
    await db.run("INSERT INTO items VALUES ('a'), ('b')");
    expect(await db.run("UPDATE items SET name = 'c'")).toEqual({ changes: 2 });
  });
});

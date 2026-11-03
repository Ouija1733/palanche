import type { Database } from 'sql.js';
import initSqlJs from 'sql.js';

import { migrate } from '../app/core/db/migrator';
import type { RunResult, SqlValue } from '../app/core/db/sql-executor';
import { BaseSqlExecutor } from '../app/core/db/sql-executor';

/** SqlExecutor on an in-memory sql.js database, for unit tests. */
export class SqlJsExecutor extends BaseSqlExecutor {
  constructor(readonly database: Database) {
    super();
  }

  protected async rawQuery<T extends object>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
    const statement = this.database.prepare(sql, [...params]);
    try {
      const rows: T[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  protected async rawRun(sql: string, params: readonly SqlValue[]): Promise<RunResult> {
    this.database.run(sql, [...params]);
    return { changes: this.database.getRowsModified() };
  }

  protected async begin(): Promise<void> {
    this.database.exec('BEGIN');
  }

  protected async commit(): Promise<void> {
    this.database.exec('COMMIT');
  }

  protected async rollback(): Promise<void> {
    this.database.exec('ROLLBACK');
  }
}

/** Creates an empty in-memory database with foreign keys on, like the app. */
export async function createTestExecutor(): Promise<SqlJsExecutor> {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.exec('PRAGMA foreign_keys = ON');
  return new SqlJsExecutor(database);
}

/** Creates an in-memory database with all migrations applied. */
export async function createMigratedTestExecutor(): Promise<SqlJsExecutor> {
  const executor = await createTestExecutor();
  await migrate(executor);
  return executor;
}

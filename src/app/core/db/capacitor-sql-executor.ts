import type { SQLiteDBConnection } from '@capacitor-community/sqlite';

import type { RunResult, SqlValue } from './sql-executor';
import { BaseSqlExecutor } from './sql-executor';

/** SqlExecutor backed by a @capacitor-community/sqlite connection. */
export class CapacitorSqlExecutor extends BaseSqlExecutor {
  constructor(
    private readonly connection: SQLiteDBConnection,
    /** Optional hook to persist committed changes (used by the web store). */
    private readonly persist?: () => Promise<void>,
  ) {
    super();
  }

  protected async rawQuery<T extends object>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
    const result = await this.connection.query(sql, [...params]);
    return (result.values ?? []) as T[];
  }

  protected async rawRun(sql: string, params: readonly SqlValue[]): Promise<RunResult> {
    // `false`: the plugin must not wrap the statement in its own transaction,
    // transactions are managed explicitly by BaseSqlExecutor.
    const result = await this.connection.run(sql, [...params], false);
    return { changes: result.changes?.changes ?? 0 };
  }

  protected async begin(): Promise<void> {
    await this.connection.beginTransaction();
  }

  protected async commit(): Promise<void> {
    await this.connection.commitTransaction();
  }

  protected async rollback(): Promise<void> {
    await this.connection.rollbackTransaction();
  }

  protected override async afterCommit(): Promise<void> {
    await this.persist?.();
  }
}

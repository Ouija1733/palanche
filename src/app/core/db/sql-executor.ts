/** Values that can be bound to SQL parameters ("?"). */
export type SqlValue = string | number | null;

export interface RunResult {
  /** Number of rows inserted, updated or deleted. */
  changes: number;
}

/**
 * The small database API the rest of the app depends on.
 *
 * Repositories talk to this interface, not to the Capacitor plugin: the app
 * implements it on top of @capacitor-community/sqlite, unit tests on top of an
 * in-memory sql.js database. Same SQL, same behaviour, no device needed.
 */
export interface SqlExecutor {
  /** Runs a SELECT and returns the rows as plain objects. */
  query<T extends object>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;

  /** Runs a statement that changes data or schema (INSERT, UPDATE, CREATE…). */
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;

  /**
   * Runs `work` inside a transaction: committed if it resolves, rolled back if
   * it throws. Inside `work`, use only the `tx` executor it receives.
   */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

/**
 * Shared transaction logic for every SqlExecutor implementation. Subclasses
 * only provide the raw operations of their driver.
 *
 * SQLite allows a single transaction per connection, so transactions are
 * queued and run one after the other. Do not call `transaction()` on the outer
 * executor from inside `work`: it would wait for itself forever.
 */
export abstract class BaseSqlExecutor implements SqlExecutor {
  private transactionQueue: Promise<unknown> = Promise.resolve();
  private inTransaction = false;

  protected abstract rawQuery<T extends object>(sql: string, params: readonly SqlValue[]): Promise<T[]>;
  protected abstract rawRun(sql: string, params: readonly SqlValue[]): Promise<RunResult>;
  protected abstract begin(): Promise<void>;
  protected abstract commit(): Promise<void>;
  protected abstract rollback(): Promise<void>;

  /** Called after every committed change. Override it to persist the data (web store). */
  protected async afterCommit(): Promise<void> {
    // Nothing to do by default: native SQLite writes straight to disk.
  }

  query<T extends object>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.rawQuery<T>(sql, params);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    const result = await this.rawRun(sql, params);
    // A write made while a transaction is open becomes durable only on commit.
    if (!this.inTransaction) {
      await this.afterCommit();
    }
    return result;
  }

  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const result = this.transactionQueue.then(() => this.runTransaction(work));
    // The queue must keep going even if this transaction fails.
    this.transactionQueue = result.catch(() => undefined);
    return result;
  }

  private async runTransaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const tx: SqlExecutor = {
      query: (sql, params = []) => this.rawQuery(sql, params),
      run: (sql, params = []) => this.rawRun(sql, params),
      transaction: () => Promise.reject(new Error('Nested transactions are not supported')),
    };

    await this.begin();
    this.inTransaction = true;
    try {
      const result = await work(tx);
      await this.commit();
      this.inTransaction = false;
      await this.afterCommit();
      return result;
    } catch (error) {
      this.inTransaction = false;
      await this.rollback();
      throw error;
    }
  }
}

import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

import { CapacitorSqlExecutor } from './capacitor-sql-executor';
import { migrate } from './migrator';
import type { SqlExecutor } from './sql-executor';

const DB_NAME = 'palanche';

/**
 * Owns the SQLite connection. `init()` runs once at startup (see main.ts),
 * before any page is shown; afterwards repositories use `db`.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private executor?: SqlExecutor;

  /** The open database. Only repositories should use it. */
  get db(): SqlExecutor {
    if (!this.executor) {
      throw new Error('DatabaseService.init() has not completed yet');
    }
    return this.executor;
  }

  async init(): Promise<void> {
    const isWeb = Capacitor.getPlatform() === 'web';
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    if (isWeb) {
      await this.initWebStore(sqlite);
    }

    // After a live reload the native side can still hold the connection.
    await sqlite.checkConnectionsConsistency();
    const exists = (await sqlite.isConnection(DB_NAME, false)).result;
    const connection = exists
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await connection.open();
    await connection.execute('PRAGMA foreign_keys = ON;', false);

    // In the browser the database lives in memory: save it to IndexedDB after every commit.
    const persist = isWeb ? () => sqlite.saveToStore(DB_NAME) : undefined;
    const executor = new CapacitorSqlExecutor(connection, persist);

    const applied = await migrate(executor);
    console.info(`[db] ready, migrations applied: ${applied.length ? applied.join(', ') : 'none'}`);
    this.executor = executor;
  }

  /**
   * In the browser the plugin is emulated by the <jeep-sqlite> web component
   * (sql.js + IndexedDB). It is imported dynamically, so the Android bundle never loads it.
   */
  private async initWebStore(sqlite: SQLiteConnection): Promise<void> {
    const { defineCustomElement } = await import('jeep-sqlite/dist/components/jeep-sqlite');
    defineCustomElement();
    // The component loads sql-wasm.wasm from /assets (copied there by angular.json).
    document.body.appendChild(document.createElement('jeep-sqlite'));
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  }
}

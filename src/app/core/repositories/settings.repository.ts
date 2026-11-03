import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { SqlExecutor } from '../db/sql-executor';
import type { SettingKey } from '../models/setting';

/** The only place with SQL for the `settings` key-value table (no soft delete). */
@Injectable({ providedIn: 'root' })
export class SettingsRepository {
  private readonly database = inject(DatabaseService);

  /** The stored value, or null if the key has never been set. */
  async get(key: SettingKey, db: SqlExecutor = this.database.db): Promise<string | null> {
    const [row] = await db.query<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  /** Inserts or replaces the value of a key. */
  async set(key: SettingKey, value: string | null, db: SqlExecutor = this.database.db): Promise<void> {
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  /** All the stored settings, including keys this version of the app does not know. */
  async getAll(db: SqlExecutor = this.database.db): Promise<Record<string, string | null>> {
    const rows = await db.query<{ key: string; value: string | null }>('SELECT key, value FROM settings ORDER BY key');
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
}

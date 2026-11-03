import { nowIso } from '../utils/dates';

import type { Migration } from './migrations';
import { MIGRATIONS } from './migrations';
import type { SqlExecutor } from './sql-executor';

const CREATE_SCHEMA_MIGRATIONS = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;

function assertSequential(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `Migrations must be numbered 1, 2, 3… without gaps: found version ${migration.version} at position ${index + 1}`,
      );
    }
  });
}

/** Highest migration version recorded in the database, 0 for a new database. */
export async function getSchemaVersion(db: SqlExecutor): Promise<number> {
  await db.run(CREATE_SCHEMA_MIGRATIONS);
  const [row] = await db.query<{ version: number | null }>('SELECT MAX(version) AS version FROM schema_migrations');
  return row?.version ?? 0;
}

/**
 * Brings the database schema up to date. Each pending migration runs in its
 * own transaction together with its row in schema_migrations, so a failure
 * leaves the database at the last fully applied version.
 *
 * @returns the versions applied by this call (empty if already up to date).
 */
export async function migrate(
  db: SqlExecutor,
  migrations: readonly Migration[] = MIGRATIONS,
  now: () => string = nowIso,
): Promise<number[]> {
  assertSequential(migrations);

  const current = await getSchemaVersion(db);
  const latest = migrations.length;
  if (current > latest) {
    throw new Error(`Database schema version ${current} is newer than this app (${latest})`);
  }

  const pending = migrations.slice(current);
  for (const migration of pending) {
    await db.transaction(async (tx) => {
      for (const statement of migration.statements) {
        await tx.run(statement);
      }
      await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        now(),
      ]);
    });
  }
  return pending.map((migration) => migration.version);
}

import type { SqlExecutor, SqlValue } from '../db/sql-executor';

/** "?, ?, ?" for an IN (…) list or a VALUES row. */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/**
 * Builds the SET part of an UPDATE from the defined fields of `changes`, using
 * `columns` both as the whitelist and as the field → column map.
 */
export function buildAssignments<T extends object>(
  changes: T,
  columns: { [K in keyof T]-?: string },
): { assignments: string[]; values: SqlValue[] } {
  const assignments: string[] = [];
  const values: SqlValue[] = [];
  for (const field of Object.keys(columns) as (keyof T)[]) {
    const value = changes[field];
    if (value !== undefined) {
      assignments.push(`${columns[field]} = ?`);
      values.push(typeof value === 'boolean' ? Number(value) : (value as SqlValue));
    }
  }
  return { assignments, values };
}

/**
 * Inserts rows exactly as given (ids and timestamps included), updating the
 * existing row with the same id. Used by backup restore and merge.
 */
export async function upsertRows(
  db: SqlExecutor,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly SqlValue[])[],
): Promise<void> {
  const updates = columns.filter((column) => column !== 'id').map((column) => `${column} = excluded.${column}`);
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders(columns.length)})
    ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`;
  for (const row of rows) {
    await db.run(sql, row);
  }
}

/** Escapes % and _ for a LIKE pattern used with ESCAPE '\'. */
export function likeContains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

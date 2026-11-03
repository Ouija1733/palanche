import type { SqlValue } from '../db/sql-executor';

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

/** Escapes % and _ for a LIKE pattern used with ESCAPE '\'. */
export function likeContains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

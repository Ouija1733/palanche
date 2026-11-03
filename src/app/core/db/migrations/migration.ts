/**
 * A schema change. Migrations are numbered from 1 without gaps and are never
 * edited once committed: every change to the schema is a new migration.
 */
export interface Migration {
  version: number;
  name: string;
  /** SQL statements, executed in order inside a single transaction. */
  statements: readonly string[];
}

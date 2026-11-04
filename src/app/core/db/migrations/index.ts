import { migration001 } from './001-initial-schema';
import { migration002 } from './002-budgets-and-savings-goals';
import type { Migration } from './migration';

/** All migrations, in order. Add new ones at the end. */
export const MIGRATIONS: readonly Migration[] = [migration001, migration002];

export type { Migration } from './migration';

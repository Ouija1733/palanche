import { migration001 } from './001-initial-schema';
import type { Migration } from './migration';

/** All migrations, in order. Add new ones at the end. */
export const MIGRATIONS: readonly Migration[] = [migration001];

export type { Migration } from './migration';

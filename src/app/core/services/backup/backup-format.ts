import { MIGRATIONS } from '../../db/migrations';
import type { Account } from '../../models/account';
import type { Category } from '../../models/category';
import type { Tag, TransactionTag } from '../../models/tag';
import type { Transaction } from '../../models/transaction';

/** Value of the `app` field: identifies a Palanche backup. */
export const BACKUP_APP = 'palanche';

/** The export format version is the database schema version. */
export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length;

/**
 * The official data contract (docs/export-format.md). One array per table,
 * deleted rows included, camelCase fields as in the app models. Arrays of
 * tables that do not exist yet are always present and empty.
 */
export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  /** ISO 8601 timestamp of the export. */
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  tags: Tag[];
  transactionTags: TransactionTag[];
  /** Phase 2. */
  budgets: never[];
  /** Phase 2. */
  savingsGoals: never[];
  /** Phase 3. */
  recurringRules: never[];
  /** Phase 3. */
  categorizationRules: never[];
  settings: Record<string, string | null>;
}

/** What the user sees before confirming an import (active rows only). */
export interface BackupSummary {
  exportedAt: string;
  schemaVersion: number;
  accounts: number;
  categories: number;
  transactions: number;
  tags: number;
}

export function summarizeBackup(file: BackupFile): BackupSummary {
  const active = (rows: readonly { deletedAt: string | null }[]) => rows.filter((row) => row.deletedAt === null).length;
  return {
    exportedAt: file.exportedAt,
    schemaVersion: file.schemaVersion,
    accounts: active(file.accounts),
    categories: active(file.categories),
    transactions: active(file.transactions),
    tags: active(file.tags),
  };
}

/** "palanche-backup-2026-11-03-1430.json", in local time. */
export function backupFileName(now: Date, prefix = 'palanche-backup'): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${prefix}-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

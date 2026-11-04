import type { AccountType } from '../../models/account';
import type { CategoryKind } from '../../models/category';
import type { CategoryColor } from '../../models/category-palette';
import { isCategoryColor } from '../../models/category-palette';
import type { TransactionType } from '../../models/transaction-type';
import { isValidIsoDate } from '../../utils/dates';

import { BackupError } from './backup-error';
import type { BackupFile } from './backup-format';
import { BACKUP_APP, CURRENT_SCHEMA_VERSION } from './backup-format';
import type { BackupUpgrade } from './backup-upgrades';
import { BACKUP_UPGRADES } from './backup-upgrades';

const ACCOUNT_TYPES: readonly AccountType[] = ['cash', 'checking', 'card', 'savings'];
const CATEGORY_KINDS: readonly CategoryKind[] = ['expense', 'income'];
const TRANSACTION_TYPES: readonly TransactionType[] = ['expense', 'income', 'transfer'];
const FUTURE_TABLES = ['recurringRules', 'categorizationRules'] as const;

const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type Row = Record<string, unknown>;

function isObject(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string, expected: string): never {
  throw new BackupError('INVALID_DATA', `${path}: expected ${expected}`);
}

/**
 * Reads typed fields from a row, throwing a BackupError with the exact path
 * of the first wrong value. Only the fields read end up in the result, so
 * unknown extra fields are ignored.
 */
class RowReader {
  constructor(
    private readonly row: Row,
    private readonly path: string,
  ) {}

  string(field: string): string {
    const value = this.row[field];
    return typeof value === 'string' && value.length > 0
      ? value
      : invalid(`${this.path}.${field}`, 'a non-empty string');
  }

  nullableString(field: string): string | null {
    const value = this.row[field] ?? null;
    return value === null || typeof value === 'string' ? value : invalid(`${this.path}.${field}`, 'a string or null');
  }

  int(field: string, min = Number.MIN_SAFE_INTEGER): number {
    const value = this.row[field];
    return Number.isSafeInteger(value) && (value as number) >= min
      ? (value as number)
      : invalid(`${this.path}.${field}`, min > 0 ? 'a positive integer' : 'an integer');
  }

  bool(field: string): boolean {
    const value = this.row[field];
    return typeof value === 'boolean' ? value : invalid(`${this.path}.${field}`, 'true or false');
  }

  oneOf<T extends string>(field: string, allowed: readonly T[]): T {
    const value = this.row[field];
    return allowed.includes(value as T)
      ? (value as T)
      : invalid(`${this.path}.${field}`, `one of ${allowed.join(', ')}`);
  }

  categoryColor(field: string): CategoryColor {
    const value = this.string(field);
    return isCategoryColor(value) ? value : invalid(`${this.path}.${field}`, 'a palette color key');
  }

  date(field: string): string {
    const value = this.string(field);
    return isValidIsoDate(value) ? value : invalid(`${this.path}.${field}`, 'a YYYY-MM-DD date');
  }

  nullableDate(field: string): string | null {
    return this.row[field] == null ? null : this.date(field);
  }

  yearMonth(field: string): string {
    const value = this.string(field);
    return YEAR_MONTH_PATTERN.test(value) ? value : invalid(`${this.path}.${field}`, 'a YYYY-MM month');
  }

  timestamp(field: string): string {
    const value = this.string(field);
    return TIMESTAMP_PATTERN.test(value) ? value : invalid(`${this.path}.${field}`, 'an ISO 8601 timestamp');
  }

  nullableTimestamp(field: string): string | null {
    return this.row[field] == null ? null : this.timestamp(field);
  }
}

function readTable<T>(data: Row, table: string, read: (reader: RowReader) => T): T[] {
  const rows = data[table];
  if (!Array.isArray(rows)) {
    invalid(table, 'an array');
  }
  return rows.map((row, index) => {
    const path = `${table}[${index}]`;
    return isObject(row) ? read(new RowReader(row, path)) : invalid(path, 'an object');
  });
}

const timestamps = (r: RowReader) => ({
  createdAt: r.timestamp('createdAt'),
  updatedAt: r.timestamp('updatedAt'),
  deletedAt: r.nullableTimestamp('deletedAt'),
});

function readSettings(data: Row): Record<string, string | null> {
  const settings = data['settings'];
  if (!isObject(settings)) {
    invalid('settings', 'an object');
  }
  for (const [key, value] of Object.entries(settings)) {
    if (value !== null && typeof value !== 'string') {
      invalid(`settings.${key}`, 'a string or null');
    }
  }
  return { ...(settings as Record<string, string | null>) };
}

/** Checks ids are unique and every reference points to a row of the file. */
function checkConsistency(file: BackupFile): void {
  const ids = (table: string, rows: readonly { id: string }[]) => {
    const set = new Set<string>();
    rows.forEach((row, index) => {
      if (set.has(row.id)) {
        invalid(`${table}[${index}].id`, 'a unique id');
      }
      set.add(row.id);
    });
    return set;
  };
  const accounts = ids('accounts', file.accounts);
  const categories = ids('categories', file.categories);
  const transactions = ids('transactions', file.transactions);
  const tags = ids('tags', file.tags);
  ids('transactionTags', file.transactionTags);

  const reference = (path: string, id: string | null, set: Set<string>) => {
    if (id !== null && !set.has(id)) {
      invalid(path, `an id present in the backup (${id})`);
    }
  };

  file.categories.forEach((category, i) => {
    reference(`categories[${i}].parentId`, category.parentId, categories);
    if (category.parentId === category.id) {
      invalid(`categories[${i}].parentId`, 'a different category');
    }
  });
  file.transactions.forEach((transaction, i) => {
    const path = `transactions[${i}]`;
    reference(`${path}.accountId`, transaction.accountId, accounts);
    reference(`${path}.toAccountId`, transaction.toAccountId, accounts);
    reference(`${path}.categoryId`, transaction.categoryId, categories);
    if ((transaction.type === 'transfer') !== (transaction.toAccountId !== null)) {
      invalid(`${path}.toAccountId`, 'a destination account for transfers only');
    }
    if (transaction.toAccountId === transaction.accountId) {
      invalid(`${path}.toAccountId`, 'an account different from accountId');
    }
  });
  file.transactionTags.forEach((link, i) => {
    reference(`transactionTags[${i}].transactionId`, link.transactionId, transactions);
    reference(`transactionTags[${i}].tagId`, link.tagId, tags);
  });

  ids('budgets', file.budgets);
  const activeBudgetSlots = new Set<string>();
  file.budgets.forEach((budget, i) => {
    reference(`budgets[${i}].categoryId`, budget.categoryId, categories);
    if (budget.deletedAt === null) {
      // Same rule as the unique index: one active budget per category (or total) and month.
      const slot = `${budget.month}|${budget.categoryId ?? ''}`;
      if (activeBudgetSlots.has(slot)) {
        invalid(`budgets[${i}]`, 'a single active budget per category and month');
      }
      activeBudgetSlots.add(slot);
    }
  });

  ids('savingsGoals', file.savingsGoals);
  file.savingsGoals.forEach((goal, i) => {
    reference(`savingsGoals[${i}].accountId`, goal.accountId, accounts);
  });
}

function upgrade(data: Row, fromVersion: number): Row {
  let upgraded = data;
  for (let version = fromVersion; version < CURRENT_SCHEMA_VERSION; version++) {
    const step: BackupUpgrade | undefined = BACKUP_UPGRADES[version];
    if (!step) {
      throw new BackupError('INVALID_DATA', `No upgrade from schema version ${version}`);
    }
    upgraded = { ...step(upgraded), schemaVersion: version + 1 };
  }
  return upgraded;
}

/**
 * Parses and validates the text of a backup file. Older schema versions are
 * upgraded to the current one, newer ones are refused. The result is safe to
 * import: types, enums, dates and references have all been checked.
 */
export function parseBackup(text: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('NOT_JSON', 'The file is not valid JSON');
  }
  if (!isObject(json) || json['app'] !== BACKUP_APP) {
    throw new BackupError('NOT_A_BACKUP', 'The file is not a Palanche backup');
  }
  const version = json['schemaVersion'];
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    invalid('schemaVersion', 'a positive integer');
  }
  if ((version as number) > CURRENT_SCHEMA_VERSION) {
    throw new BackupError(
      'NEWER_VERSION',
      `Backup schema version ${version} is newer than this app (${CURRENT_SCHEMA_VERSION})`,
    );
  }

  const data = upgrade(json, version as number);
  const file: BackupFile = {
    app: BACKUP_APP,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new RowReader(data, 'backup').timestamp('exportedAt'),
    accounts: readTable(data, 'accounts', (r) => ({
      id: r.string('id'),
      name: r.string('name'),
      type: r.oneOf('type', ACCOUNT_TYPES),
      currency: r.string('currency'),
      initialBalanceCents: r.int('initialBalanceCents'),
      archived: r.bool('archived'),
      sortOrder: r.int('sortOrder'),
      ...timestamps(r),
    })),
    categories: readTable(data, 'categories', (r) => ({
      id: r.string('id'),
      parentId: r.nullableString('parentId'),
      name: r.string('name'),
      kind: r.oneOf('kind', CATEGORY_KINDS),
      icon: r.string('icon'),
      color: r.categoryColor('color'),
      sortOrder: r.int('sortOrder'),
      ...timestamps(r),
    })),
    transactions: readTable(data, 'transactions', (r) => ({
      id: r.string('id'),
      type: r.oneOf('type', TRANSACTION_TYPES),
      amountCents: r.int('amountCents', 1),
      accountId: r.string('accountId'),
      toAccountId: r.nullableString('toAccountId'),
      categoryId: r.nullableString('categoryId'),
      date: r.date('date'),
      payee: r.nullableString('payee'),
      note: r.nullableString('note'),
      ...timestamps(r),
    })),
    tags: readTable(data, 'tags', (r) => ({ id: r.string('id'), name: r.string('name'), ...timestamps(r) })),
    transactionTags: readTable(data, 'transactionTags', (r) => ({
      id: r.string('id'),
      transactionId: r.string('transactionId'),
      tagId: r.string('tagId'),
      ...timestamps(r),
    })),
    budgets: readTable(data, 'budgets', (r) => ({
      id: r.string('id'),
      categoryId: r.nullableString('categoryId'),
      month: r.yearMonth('month'),
      amountCents: r.int('amountCents', 1),
      ...timestamps(r),
    })),
    savingsGoals: readTable(data, 'savingsGoals', (r) => ({
      id: r.string('id'),
      name: r.string('name'),
      targetCents: r.int('targetCents', 1),
      targetDate: r.nullableDate('targetDate'),
      accountId: r.string('accountId'),
      sortOrder: r.int('sortOrder'),
      ...timestamps(r),
    })),
    recurringRules: [],
    categorizationRules: [],
    settings: readSettings(data),
  };

  for (const table of FUTURE_TABLES) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length > 0) {
      invalid(table, `an empty array in schema version ${CURRENT_SCHEMA_VERSION}`);
    }
  }
  checkConsistency(file);
  return file;
}

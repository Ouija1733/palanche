import type { Migration } from './migration';

/**
 * Phase 1 schema: accounts, categories, transactions, tags, settings.
 *
 * Conventions: UUID text ids; created_at / updated_at / deleted_at as ISO 8601
 * text (rows are soft-deleted, so foreign keys have no ON DELETE action);
 * money as integer cents; accounting dates as "YYYY-MM-DD".
 */
export const migration001: Migration = {
  version: 1,
  name: 'initial-schema',
  statements: [
    `CREATE TABLE accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('cash', 'checking', 'card', 'savings')),
      currency TEXT NOT NULL DEFAULT 'EUR',
      initial_balance_cents INTEGER NOT NULL DEFAULT 0
        CHECK (typeof(initial_balance_cents) = 'integer'),
      archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,

    `CREATE TABLE categories (
      id TEXT PRIMARY KEY NOT NULL,
      parent_id TEXT REFERENCES categories (id),
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      CHECK (parent_id IS NULL OR parent_id <> id)
    )`,
    `CREATE INDEX idx_categories_parent_id ON categories (parent_id)`,

    `CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
      amount_cents INTEGER NOT NULL
        CHECK (typeof(amount_cents) = 'integer' AND amount_cents > 0),
      account_id TEXT NOT NULL REFERENCES accounts (id),
      to_account_id TEXT REFERENCES accounts (id),
      category_id TEXT REFERENCES categories (id),
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
      payee TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      CHECK ((type = 'transfer') = (to_account_id IS NOT NULL)),
      CHECK (to_account_id IS NULL OR to_account_id <> account_id)
    )`,
    `CREATE INDEX idx_transactions_date ON transactions (date)`,
    `CREATE INDEX idx_transactions_account_id ON transactions (account_id)`,
    `CREATE INDEX idx_transactions_to_account_id ON transactions (to_account_id)`,
    `CREATE INDEX idx_transactions_category_id ON transactions (category_id)`,

    `CREATE TABLE tags (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    // A name can be reused once the old tag has been deleted.
    `CREATE UNIQUE INDEX idx_tags_name ON tags (name COLLATE NOCASE) WHERE deleted_at IS NULL`,

    `CREATE TABLE transaction_tags (
      id TEXT PRIMARY KEY NOT NULL,
      transaction_id TEXT NOT NULL REFERENCES transactions (id),
      tag_id TEXT NOT NULL REFERENCES tags (id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE UNIQUE INDEX idx_transaction_tags_pair
      ON transaction_tags (transaction_id, tag_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_transaction_tags_tag_id ON transaction_tags (tag_id)`,

    `CREATE TABLE settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    )`,
  ],
};

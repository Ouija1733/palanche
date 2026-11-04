import type { Migration } from './migration';

/**
 * Phase 2: monthly budgets and savings goals. Same conventions as 001.
 *
 * A budget with category_id NULL is the optional total budget of the month.
 * `month` is the name of the accounting month ("YYYY-MM"), so changing the
 * day on which the month starts never rewrites budgets. A savings goal's
 * progress is the balance of its account: always computed, never stored.
 */
export const migration002: Migration = {
  version: 2,
  name: 'budgets-and-savings-goals',
  statements: [
    `CREATE TABLE budgets (
      id TEXT PRIMARY KEY NOT NULL,
      category_id TEXT REFERENCES categories (id),
      month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
      amount_cents INTEGER NOT NULL
        CHECK (typeof(amount_cents) = 'integer' AND amount_cents > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    // One active budget per category and month (and one total per month: NULL becomes '').
    `CREATE UNIQUE INDEX idx_budgets_month_category
      ON budgets (month, IFNULL(category_id, '')) WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_budgets_category_id ON budgets (category_id)`,

    `CREATE TABLE savings_goals (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      target_cents INTEGER NOT NULL
        CHECK (typeof(target_cents) = 'integer' AND target_cents > 0),
      target_date TEXT
        CHECK (target_date IS NULL OR target_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
      account_id TEXT NOT NULL REFERENCES accounts (id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX idx_savings_goals_account_id ON savings_goals (account_id)`,
  ],
};

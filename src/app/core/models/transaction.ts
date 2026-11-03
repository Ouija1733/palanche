import type { IsoDate } from '../utils/dates';

import type { CategoryColor } from './category-palette';
import type { TransactionType } from './transaction-type';

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Always positive: the type gives the sign. */
  amountCents: number;
  accountId: string;
  /** Destination account, only for transfers. */
  toAccountId: string | null;
  /** Category, never set for transfers. */
  categoryId: string | null;
  date: IsoDate;
  payee: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type NewTransaction = Pick<Transaction, 'type' | 'amountCents' | 'accountId' | 'date'> &
  Partial<Pick<Transaction, 'toAccountId' | 'categoryId' | 'payee' | 'note'>>;

export type TransactionChanges = Partial<
  Pick<Transaction, 'type' | 'amountCents' | 'accountId' | 'toAccountId' | 'categoryId' | 'date' | 'payee' | 'note'>
>;

/** A transaction with the names and appearance needed to show it in a list. */
export interface TransactionListItem extends Transaction {
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
  /** Name of the parent category, when the category is a subcategory. */
  parentCategoryName: string | null;
  categoryIcon: string | null;
  categoryColor: CategoryColor | null;
  /** Tag names, sorted alphabetically. */
  tags: string[];
}

/**
 * Filters for the transaction list. Every field is optional; an empty array
 * means "no filter" on that field.
 */
export interface TransactionFilter {
  from?: IsoDate;
  to?: IsoDate;
  /** Matches the source or the destination account. */
  accountIds?: readonly string[];
  /** Matches the categories and their subcategories. */
  categoryIds?: readonly string[];
  types?: readonly TransactionType[];
  /** Matches transactions with at least one of the tags. */
  tagIds?: readonly string[];
  /** Searched in note and payee. */
  text?: string;
}

/** Count and net amount (income − expenses, transfers excluded) of a set of transactions. */
export interface TransactionSummary {
  count: number;
  netCents: number;
}

/** Per-account totals used to compute balances. */
export interface AccountMovements {
  incomeCents: number;
  expenseCents: number;
  transferOutCents: number;
  transferInCents: number;
}

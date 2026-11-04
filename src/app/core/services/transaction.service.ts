import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { SqlExecutor } from '../db/sql-executor';
import type { Tag } from '../models/tag';
import type { Transaction, TransactionFilter, TransactionListItem, TransactionSummary } from '../models/transaction';
import type { TransactionType } from '../models/transaction-type';
import { AccountsRepository } from '../repositories/accounts.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { TagsRepository } from '../repositories/tags.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';
import type { IsoDate } from '../utils/dates';
import { isValidIsoDate } from '../utils/dates';

import { DataChangesService } from './data-changes.service';
import { DomainError } from './domain-error';

/** What the new / edit transaction form sends. */
export interface TransactionInput {
  type: TransactionType;
  amountCents: number;
  accountId: string;
  /** Required for transfers, must be absent otherwise. */
  toAccountId?: string | null;
  /** Required for expenses and income, must be absent for transfers. */
  categoryId?: string | null;
  date: IsoDate;
  payee?: string | null;
  note?: string | null;
  /** Tag names; missing tags are created. */
  tags?: readonly string[];
}

/** A transaction with its tag names, to fill the edit form. */
export interface EditableTransaction {
  transaction: Transaction;
  tags: string[];
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Tag names trimmed, without empty ones and without case-insensitive duplicates. */
function cleanTags(names: readonly string[] = []): string[] {
  const byKey = new Map<string, string>();
  for (const name of names) {
    const trimmed = name.trim();
    const key = trimmed.toLocaleLowerCase('it');
    if (trimmed && !byKey.has(key)) {
      byKey.set(key, trimmed);
    }
  }
  return [...byKey.values()];
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly database = inject(DatabaseService);
  private readonly transactions = inject(TransactionsRepository);
  private readonly accounts = inject(AccountsRepository);
  private readonly categories = inject(CategoriesRepository);
  private readonly tags = inject(TagsRepository);
  private readonly settings = inject(SettingsRepository);
  private readonly changes = inject(DataChangesService);

  /** Transactions matching the filter, newest first, ready to be listed; `page` pages through them. */
  async list(
    filter: TransactionFilter = {},
    page: { limit?: number; offset?: number } = {},
  ): Promise<TransactionListItem[]> {
    return this.transactions.search(filter, page);
  }

  /** Count and net amount of everything matching the filter (not only the loaded page). */
  async summarize(filter: TransactionFilter = {}): Promise<TransactionSummary> {
    return this.transactions.summarize(filter);
  }

  /** Net amount per day for the filter, for the day totals of the list. */
  async netByDate(filter: TransactionFilter = {}): Promise<Map<IsoDate, number>> {
    return this.transactions.netByDate(filter);
  }

  async getForEdit(id: string): Promise<EditableTransaction | null> {
    const transaction = await this.transactions.findById(id);
    if (!transaction) {
      return null;
    }
    const tags = await this.tags.findByTransaction(id);
    return { transaction, tags: tags.map((tag) => tag.name) };
  }

  /**
   * Validates and saves a transaction with its tags, all in one SQL
   * transaction. Creates it when `id` is missing, updates it otherwise.
   * The account becomes the preselected one for the next transaction.
   */
  async save(input: TransactionInput, id?: string): Promise<Transaction> {
    const saved = await this.database.db.transaction(async (tx) => {
      const values = await this.validate(input, tx);
      const result = id ? await this.transactions.update(id, values, tx) : await this.transactions.create(values, tx);

      const tagIds: string[] = [];
      for (const name of cleanTags(input.tags)) {
        tagIds.push((await this.tags.findOrCreate(name, tx)).id);
      }
      await this.tags.setTransactionTags(result.id, tagIds, tx);
      await this.settings.set('last_account_id', result.accountId, tx);
      return result;
    });
    this.changes.notify();
    return saved;
  }

  /** Soft delete; the tags stay linked so that `restore()` brings them back. */
  async delete(id: string): Promise<void> {
    await this.transactions.softDelete(id);
    this.changes.notify();
  }

  async restore(id: string): Promise<void> {
    await this.transactions.restore(id);
    this.changes.notify();
  }

  /** The existing tags, alphabetically, e.g. for the tag filter. */
  async getTags(): Promise<Tag[]> {
    return this.tags.findAll();
  }

  /** Names of the existing tags, for suggestions while typing. */
  async getTagNames(): Promise<string[]> {
    return (await this.tags.findAll()).map((tag) => tag.name);
  }

  /** Account to preselect in the form: the last one used, if still active. */
  async getDefaultAccountId(): Promise<string | null> {
    const lastId = await this.settings.get('last_account_id');
    const last = lastId ? await this.accounts.findById(lastId) : null;
    if (last && !last.archived) {
      return last.id;
    }
    const [first] = await this.accounts.findAll();
    return first?.id ?? null;
  }

  private async validate(input: TransactionInput, db: SqlExecutor) {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new DomainError('INVALID_AMOUNT', `Amount must be positive integer cents, got ${input.amountCents}`);
    }
    if (!isValidIsoDate(input.date)) {
      throw new DomainError('INVALID_DATE', `Invalid date: ${input.date}`);
    }
    if (!(await this.accounts.findById(input.accountId, db))) {
      throw new DomainError('ACCOUNT_NOT_FOUND', `Account not found: ${input.accountId}`);
    }

    const toAccountId = input.toAccountId ?? null;
    const categoryId = input.categoryId ?? null;

    if (input.type === 'transfer') {
      if (!toAccountId || toAccountId === input.accountId) {
        throw new DomainError('TRANSFER_ACCOUNTS', 'A transfer needs a destination account different from the source');
      }
      if (!(await this.accounts.findById(toAccountId, db))) {
        throw new DomainError('ACCOUNT_NOT_FOUND', `Account not found: ${toAccountId}`);
      }
      if (categoryId) {
        throw new DomainError('CATEGORY_NOT_ALLOWED', 'Transfers have no category');
      }
    } else {
      if (toAccountId) {
        throw new DomainError('TRANSFER_ACCOUNTS', 'Only transfers have a destination account');
      }
      if (!categoryId) {
        throw new DomainError('CATEGORY_REQUIRED', 'Expenses and income need a category');
      }
      const category = await this.categories.findById(categoryId, db);
      if (!category) {
        throw new DomainError('CATEGORY_NOT_FOUND', `Category not found: ${categoryId}`);
      }
      if (category.kind !== input.type) {
        throw new DomainError('CATEGORY_KIND_MISMATCH', `A ${input.type} needs a ${input.type} category`);
      }
    }

    return {
      type: input.type,
      amountCents: input.amountCents,
      accountId: input.accountId,
      toAccountId,
      categoryId,
      date: input.date,
      payee: cleanText(input.payee),
      note: cleanText(input.note),
    };
  }
}

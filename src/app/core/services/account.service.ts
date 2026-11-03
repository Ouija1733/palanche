import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { Account, AccountChanges, NewAccount } from '../models/account';
import { AccountsRepository } from '../repositories/accounts.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

import { DomainError } from './domain-error';

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new DomainError('INVALID_NAME', 'Account name cannot be empty');
  }
  return trimmed;
}

function assertInitialBalance(cents: number | undefined): void {
  if (cents !== undefined && !Number.isSafeInteger(cents)) {
    throw new DomainError('INVALID_AMOUNT', `Initial balance must be integer cents, got ${cents}`);
  }
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly database = inject(DatabaseService);
  private readonly accounts = inject(AccountsRepository);
  private readonly transactions = inject(TransactionsRepository);

  /** Creates an account at the end of the list. */
  async create(input: NewAccount): Promise<Account> {
    assertInitialBalance(input.initialBalanceCents);
    const name = cleanName(input.name);
    return this.database.db.transaction(async (tx) => {
      const existing = await this.accounts.findAll({ includeArchived: true }, tx);
      const sortOrder = existing.reduce((max, account) => Math.max(max, account.sortOrder + 1), 0);
      return this.accounts.create({ ...input, name, sortOrder }, tx);
    });
  }

  async update(id: string, changes: AccountChanges): Promise<Account> {
    assertInitialBalance(changes.initialBalanceCents);
    const name = changes.name === undefined ? undefined : cleanName(changes.name);
    return this.accounts.update(id, { ...changes, name });
  }

  async setArchived(id: string, archived: boolean): Promise<Account> {
    return this.accounts.update(id, { archived });
  }

  /**
   * Deletes an account without transactions. An account with transactions
   * cannot be deleted (its balance history would be lost): archive it instead.
   */
  async delete(id: string): Promise<void> {
    if ((await this.transactions.countByAccount(id)) > 0) {
      throw new DomainError('ACCOUNT_HAS_TRANSACTIONS', 'An account with transactions can only be archived');
    }
    if (!(await this.accounts.softDelete(id))) {
      throw new DomainError('ACCOUNT_NOT_FOUND', `Account not found: ${id}`);
    }
  }

  async restore(id: string): Promise<void> {
    await this.accounts.restore(id);
  }

  /** Saves the display order: `ids` from first to last. */
  async reorder(ids: readonly string[]): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await this.accounts.update(id, { sortOrder: index }, tx);
      }
    });
  }
}

import { inject, Injectable } from '@angular/core';

import type { Account } from '../models/account';
import type { AccountMovements } from '../models/transaction';
import { AccountsRepository } from '../repositories/accounts.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

export interface AccountBalance {
  account: Account;
  balanceCents: number;
}

const NO_MOVEMENTS: AccountMovements = { incomeCents: 0, expenseCents: 0, transferOutCents: 0, transferInCents: 0 };

/** Balance = initial balance + income − expenses − transfers out + transfers in. */
export function computeBalance(initialBalanceCents: number, movements: AccountMovements = NO_MOVEMENTS): number {
  return (
    initialBalanceCents +
    movements.incomeCents -
    movements.expenseCents -
    movements.transferOutCents +
    movements.transferInCents
  );
}

/** Balances are always computed from the transactions, never stored. */
@Injectable({ providedIn: 'root' })
export class BalanceService {
  private readonly accounts = inject(AccountsRepository);
  private readonly transactions = inject(TransactionsRepository);

  /** Balance of every account, in display order; archived accounts only if requested. */
  async getBalances(options: { includeArchived?: boolean } = {}): Promise<AccountBalance[]> {
    const [accounts, movements] = await Promise.all([
      this.accounts.findAll(options),
      this.transactions.movementsByAccount(),
    ]);
    return accounts.map((account) => ({
      account,
      balanceCents: computeBalance(account.initialBalanceCents, movements.get(account.id)),
    }));
  }

  /** Sum of the balances of the active (not archived) accounts. */
  async getTotal(): Promise<number> {
    const balances = await this.getBalances();
    return balances.reduce((total, { balanceCents }) => total + balanceCents, 0);
  }
}

import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import { AccountsRepository } from '../repositories/accounts.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

import { BalanceService, computeBalance } from './balance.service';

describe('computeBalance', () => {
  it('adds income and incoming transfers, subtracts expenses and outgoing transfers', () => {
    expect(
      computeBalance(10000, { incomeCents: 5000, expenseCents: 2000, transferOutCents: 1000, transferInCents: 300 }),
    ).toBe(12300);
  });

  it('returns the initial balance without movements', () => {
    expect(computeBalance(-2500)).toBe(-2500);
  });
});

describe('BalanceService', () => {
  let balances: BalanceService;
  let accounts: AccountsRepository;
  let transactions: TransactionsRepository;

  beforeEach(async () => {
    await setUpTestDatabase();
    balances = TestBed.inject(BalanceService);
    accounts = TestBed.inject(AccountsRepository);
    transactions = TestBed.inject(TransactionsRepository);
  });

  it('computes balances that match the transactions (phase 1 criterion)', async () => {
    const categories = TestBed.inject(CategoriesRepository);
    const food = await categories.create({ name: 'Spesa', kind: 'expense', icon: 'cart-outline', color: 'teal' });
    const salary = await categories.create({
      name: 'Stipendio',
      kind: 'income',
      icon: 'briefcase-outline',
      color: 'teal',
    });
    const checking = await accounts.create({
      name: 'Conto corrente',
      type: 'checking',
      initialBalanceCents: 150000,
      sortOrder: 0,
    });
    const cash = await accounts.create({ name: 'Contanti', type: 'cash', initialBalanceCents: 5000, sortOrder: 1 });
    const card = await accounts.create({ name: 'Prepagata', type: 'card', sortOrder: 2 });
    const base = { categoryId: food.id, date: '2026-11-10' };

    await transactions.create({ ...base, type: 'expense', amountCents: 3820, accountId: checking.id });
    await transactions.create({ ...base, type: 'expense', amountCents: 2700, accountId: cash.id });
    await transactions.create({ ...base, type: 'expense', amountCents: 450, accountId: card.id });
    await transactions.create({
      type: 'income',
      amountCents: 200000,
      accountId: checking.id,
      categoryId: salary.id,
      date: '2026-11-13',
    });
    await transactions.create({
      type: 'transfer',
      amountCents: 10000,
      accountId: checking.id,
      toAccountId: card.id,
      date: '2026-11-13',
    });
    await transactions.create({
      type: 'transfer',
      amountCents: 2000,
      accountId: checking.id,
      toAccountId: cash.id,
      date: '2026-11-14',
    });
    const deleted = await transactions.create({ ...base, type: 'expense', amountCents: 99999, accountId: cash.id });
    await transactions.softDelete(deleted.id);

    const result = await balances.getBalances();

    expect(result.map(({ account, balanceCents }) => [account.name, balanceCents])).toEqual([
      ['Conto corrente', 150000 - 3820 + 200000 - 10000 - 2000],
      ['Contanti', 5000 - 2700 + 2000],
      ['Prepagata', -450 + 10000],
    ]);
    // Transfers move money between accounts: the total only changes with income and expenses.
    expect(await balances.getTotal()).toBe(150000 + 5000 + 200000 - 3820 - 2700 - 450);
  });

  it('excludes archived accounts from the total but can list them', async () => {
    await accounts.create({ name: 'Conto corrente', type: 'checking', initialBalanceCents: 1000 });
    const old = await accounts.create({ name: 'Vecchio', type: 'savings', initialBalanceCents: 500 });
    await accounts.update(old.id, { archived: true });

    expect(await balances.getTotal()).toBe(1000);
    expect(await balances.getBalances({ includeArchived: true })).toHaveLength(2);
  });

  it('allows negative balances', async () => {
    const card = await accounts.create({ name: 'Carta', type: 'card' });
    const categories = TestBed.inject(CategoriesRepository);
    const food = await categories.create({ name: 'Spesa', kind: 'expense', icon: 'cart-outline', color: 'teal' });
    await transactions.create({
      type: 'expense',
      amountCents: 1500,
      accountId: card.id,
      categoryId: food.id,
      date: '2026-11-01',
    });
    expect(await balances.getTotal()).toBe(-1500);
  });
});

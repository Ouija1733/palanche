import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { Account } from '../models/account';
import type { Category } from '../models/category';
import { AccountsRepository } from '../repositories/accounts.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

import type { TransactionInput } from './transaction.service';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  let service: TransactionService;
  let repository: TransactionsRepository;
  let checking: Account;
  let cash: Account;
  let food: Category;
  let salary: Category;

  const expense = (extra: Partial<TransactionInput> = {}): TransactionInput => ({
    type: 'expense',
    amountCents: 1250,
    accountId: checking.id,
    categoryId: food.id,
    date: '2026-11-15',
    ...extra,
  });

  beforeEach(async () => {
    await setUpTestDatabase();
    service = TestBed.inject(TransactionService);
    repository = TestBed.inject(TransactionsRepository);
    const accounts = TestBed.inject(AccountsRepository);
    const categories = TestBed.inject(CategoriesRepository);
    checking = await accounts.create({ name: 'Conto corrente', type: 'checking', sortOrder: 0 });
    cash = await accounts.create({ name: 'Contanti', type: 'cash', sortOrder: 1 });
    food = await categories.create({ name: 'Spesa', kind: 'expense', icon: 'cart-outline', color: 'teal' });
    salary = await categories.create({ name: 'Stipendio', kind: 'income', icon: 'briefcase-outline', color: 'teal' });
  });

  it('creates an expense with cleaned text and tags', async () => {
    const saved = await service.save(
      expense({ payee: '  Esselunga ', note: '   ', tags: ['Casa', ' casa', 'vacanze', ''] }),
    );

    expect(saved).toEqual(expect.objectContaining({ payee: 'Esselunga', note: null, toAccountId: null }));
    expect(await service.getForEdit(saved.id)).toEqual({ transaction: saved, tags: ['Casa', 'vacanze'] });
  });

  it('updates a transaction and replaces its tags', async () => {
    const saved = await service.save(expense({ tags: ['a', 'b'] }));
    const updated = await service.save(expense({ amountCents: 999, tags: ['b', 'c'] }), saved.id);

    expect(updated.id).toBe(saved.id);
    expect(updated.amountCents).toBe(999);
    expect((await service.getForEdit(saved.id))?.tags).toEqual(['b', 'c']);
  });

  it('saves a transfer and an income', async () => {
    const transfer = await service.save({
      type: 'transfer',
      amountCents: 10000,
      accountId: checking.id,
      toAccountId: cash.id,
      date: '2026-11-13',
    });
    const income = await service.save({
      type: 'income',
      amountCents: 200000,
      accountId: checking.id,
      categoryId: salary.id,
      date: '2026-11-13',
    });
    expect(transfer).toEqual(expect.objectContaining({ toAccountId: cash.id, categoryId: null }));
    expect(income.categoryId).toBe(salary.id);
  });

  it('remembers the last account used and preselects it', async () => {
    expect(await service.getDefaultAccountId()).toBe(checking.id);
    await service.save(expense({ accountId: cash.id }));
    expect(await TestBed.inject(SettingsRepository).get('last_account_id')).toBe(cash.id);
    expect(await service.getDefaultAccountId()).toBe(cash.id);

    await TestBed.inject(AccountsRepository).update(cash.id, { archived: true });
    expect(await service.getDefaultAccountId()).toBe(checking.id);
  });

  it.each([
    ['a zero amount', { amountCents: 0 }, 'INVALID_AMOUNT'],
    ['a decimal amount', { amountCents: 12.5 }, 'INVALID_AMOUNT'],
    ['an invalid date', { date: '2026-02-30' }, 'INVALID_DATE'],
    ['a missing account', { accountId: 'missing' }, 'ACCOUNT_NOT_FOUND'],
    ['an expense without category', { categoryId: null }, 'CATEGORY_REQUIRED'],
    ['an expense with a destination', { toAccountId: 'x' }, 'TRANSFER_ACCOUNTS'],
    ['a missing category', { categoryId: 'missing' }, 'CATEGORY_NOT_FOUND'],
  ] as const)('rejects %s', async (_label, change, code) => {
    await expect(service.save(expense(change))).rejects.toMatchObject({ code });
  });

  it('rejects an expense with an income category and vice versa', async () => {
    await expect(service.save(expense({ categoryId: salary.id }))).rejects.toMatchObject({
      code: 'CATEGORY_KIND_MISMATCH',
    });
    await expect(service.save(expense({ type: 'income' }))).rejects.toMatchObject({ code: 'CATEGORY_KIND_MISMATCH' });
  });

  it('rejects invalid transfers', async () => {
    const transfer = { type: 'transfer', categoryId: null } as const;
    await expect(service.save(expense({ ...transfer }))).rejects.toMatchObject({ code: 'TRANSFER_ACCOUNTS' });
    await expect(service.save(expense({ ...transfer, toAccountId: checking.id }))).rejects.toMatchObject({
      code: 'TRANSFER_ACCOUNTS',
    });
    await expect(
      service.save(expense({ ...transfer, toAccountId: cash.id, categoryId: food.id })),
    ).rejects.toMatchObject({
      code: 'CATEGORY_NOT_ALLOWED',
    });
  });

  it('saves nothing when a later step fails (single transaction)', async () => {
    vi.spyOn(TestBed.inject(SettingsRepository), 'set').mockRejectedValueOnce(new Error('disk full'));
    await expect(service.save(expense({ tags: ['casa'] }))).rejects.toThrow('disk full');
    expect(await repository.search()).toEqual([]);
  });

  it('deletes and restores a transaction with its tags (undo toast)', async () => {
    const saved = await service.save(expense({ tags: ['lampadine'] }));
    await service.delete(saved.id);
    expect(await repository.search()).toEqual([]);

    await service.restore(saved.id);
    const [restored] = await repository.search();
    expect(restored).toEqual(expect.objectContaining({ id: saved.id, tags: ['lampadine'] }));
  });
});

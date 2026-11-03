import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import { AccountsRepository } from '../repositories/accounts.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let accounts: AccountsRepository;

  beforeEach(async () => {
    await setUpTestDatabase();
    service = TestBed.inject(AccountService);
    accounts = TestBed.inject(AccountsRepository);
  });

  it('appends new accounts at the end and trims the name', async () => {
    const first = await service.create({ name: ' Conto corrente ', type: 'checking' });
    const second = await service.create({ name: 'Contanti', type: 'cash' });
    expect(first).toEqual(expect.objectContaining({ name: 'Conto corrente', sortOrder: 0, currency: 'EUR' }));
    expect(second.sortOrder).toBe(1);
  });

  it('rejects empty names and non-integer balances', async () => {
    await expect(service.create({ name: '  ', type: 'cash' })).rejects.toMatchObject({ code: 'INVALID_NAME' });
    await expect(service.create({ name: 'X', type: 'cash', initialBalanceCents: 1.5 })).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    });
  });

  it('reorders accounts', async () => {
    const a = await service.create({ name: 'A', type: 'cash' });
    const b = await service.create({ name: 'B', type: 'cash' });
    const c = await service.create({ name: 'C', type: 'cash' });
    await service.reorder([c.id, a.id, b.id]);
    expect((await accounts.findAll()).map((account) => account.name)).toEqual(['C', 'A', 'B']);
  });

  it('deletes an account without transactions and can restore it', async () => {
    const account = await service.create({ name: 'Contanti', type: 'cash' });
    await service.delete(account.id);
    expect(await accounts.findById(account.id)).toBeNull();
    await service.restore(account.id);
    expect(await accounts.findById(account.id)).not.toBeNull();
  });

  it('refuses to delete an account with transactions, which can be archived instead', async () => {
    const account = await service.create({ name: 'Contanti', type: 'cash' });
    const food = await TestBed.inject(CategoriesRepository).create({
      name: 'Spesa',
      kind: 'expense',
      icon: 'cart-outline',
      color: 'teal',
    });
    await TestBed.inject(TransactionsRepository).create({
      type: 'expense',
      amountCents: 100,
      accountId: account.id,
      categoryId: food.id,
      date: '2026-11-01',
    });

    await expect(service.delete(account.id)).rejects.toMatchObject({ code: 'ACCOUNT_HAS_TRANSACTIONS' });
    expect((await service.setArchived(account.id, true)).archived).toBe(true);
  });
});

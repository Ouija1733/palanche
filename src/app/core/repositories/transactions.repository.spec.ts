import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { Account } from '../models/account';
import type { Category } from '../models/category';
import type { NewTransaction } from '../models/transaction';

import { AccountsRepository } from './accounts.repository';
import { CategoriesRepository } from './categories.repository';
import { TagsRepository } from './tags.repository';
import { TransactionsRepository } from './transactions.repository';

describe('TransactionsRepository', () => {
  let transactions: TransactionsRepository;
  let tags: TagsRepository;
  let checking: Account;
  let cash: Account;
  let home: Category;
  let rent: Category;
  let groceries: Category;
  let salary: Category;

  beforeEach(async () => {
    await setUpTestDatabase();
    transactions = TestBed.inject(TransactionsRepository);
    tags = TestBed.inject(TagsRepository);
    const accounts = TestBed.inject(AccountsRepository);
    const categories = TestBed.inject(CategoriesRepository);

    checking = await accounts.create({ name: 'Conto corrente', type: 'checking' });
    cash = await accounts.create({ name: 'Contanti', type: 'cash' });
    home = await categories.create({ name: 'Casa', kind: 'expense', icon: 'home-outline', color: 'violet' });
    rent = await categories.create({
      name: 'Affitto',
      kind: 'expense',
      icon: 'home-outline',
      color: 'violet',
      parentId: home.id,
    });
    groceries = await categories.create({ name: 'Spesa', kind: 'expense', icon: 'cart-outline', color: 'teal' });
    salary = await categories.create({ name: 'Stipendio', kind: 'income', icon: 'briefcase-outline', color: 'teal' });
  });

  const expense = (amountCents: number, date: string, extra: Partial<NewTransaction> = {}) =>
    transactions.create({
      type: 'expense',
      amountCents,
      accountId: checking.id,
      categoryId: groceries.id,
      date,
      ...extra,
    });

  describe('create / update / delete', () => {
    it('creates and reads back a transaction', async () => {
      const created = await expense(3820, '2026-11-15', { payee: 'Esselunga', note: 'Settimana' });
      expect(await transactions.findById(created.id)).toEqual(created);
      expect(created).toEqual(expect.objectContaining({ toAccountId: null, deletedAt: null }));
    });

    it('updates only the given fields', async () => {
      const created = await expense(3820, '2026-11-15');
      const updated = await transactions.update(created.id, { amountCents: 4000, note: 'Corretto' });
      expect(updated).toEqual(expect.objectContaining({ amountCents: 4000, note: 'Corretto', date: '2026-11-15' }));
    });

    it('changes an expense into a transfer in one update', async () => {
      const created = await expense(10000, '2026-11-13');
      const updated = await transactions.update(created.id, {
        type: 'transfer',
        toAccountId: cash.id,
        categoryId: null,
      });
      expect(updated).toEqual(expect.objectContaining({ type: 'transfer', toAccountId: cash.id, categoryId: null }));
    });

    it('soft-deletes and restores', async () => {
      const created = await expense(3820, '2026-11-15');
      expect(await transactions.softDelete(created.id)).toBe(true);
      expect(await transactions.findById(created.id)).toBeNull();
      expect(await transactions.search()).toEqual([]);
      expect(await transactions.restore(created.id)).toBe(true);
      expect(await transactions.search()).toHaveLength(1);
    });
  });

  describe('search', () => {
    it('returns names, appearance and tags, newest first', async () => {
      const older = await expense(120000, '2026-11-01', { categoryId: rent.id });
      const newer = await transactions.create({
        type: 'transfer',
        amountCents: 10000,
        accountId: checking.id,
        toAccountId: cash.id,
        date: '2026-11-13',
      });
      const [b, a] = await Promise.all([tags.findOrCreate('bolletta'), tags.findOrCreate('Affitto')]);
      await tags.setTransactionTags(older.id, [b.id, a.id]);

      const [first, second] = await transactions.search();

      expect(first).toEqual(
        expect.objectContaining({
          id: newer.id,
          accountName: 'Conto corrente',
          toAccountName: 'Contanti',
          categoryName: null,
          tags: [],
        }),
      );
      expect(second).toEqual(
        expect.objectContaining({
          id: older.id,
          categoryName: 'Affitto',
          parentCategoryName: 'Casa',
          categoryIcon: 'home-outline',
          categoryColor: 'violet',
          tags: ['Affitto', 'bolletta'],
        }),
      );
    });

    it('orders by date, then by creation within the same day, and pages', async () => {
      vi.useFakeTimers({ now: new Date('2026-11-15T09:00:00Z'), toFake: ['Date'] });
      const first = await expense(100, '2026-11-15');
      vi.setSystemTime(new Date('2026-11-15T09:05:00Z'));
      const second = await expense(200, '2026-11-15');
      await expense(300, '2026-11-14');
      vi.useRealTimers();

      const all = await transactions.search();
      expect(all.map((t) => t.amountCents)).toEqual([200, 100, 300]);
      expect(all[0].id).toBe(second.id);
      expect(all[1].id).toBe(first.id);

      const page = await transactions.search({}, { limit: 2, offset: 1 });
      expect(page.map((t) => t.amountCents)).toEqual([100, 300]);
    });

    it('breaks ties on the same creation time by id, so the order survives a backup restore', async () => {
      vi.useFakeTimers({ now: new Date('2026-11-15T09:00:00Z'), toFake: ['Date'] });
      const ids = [(await expense(1, '2026-11-15')).id, (await expense(2, '2026-11-15')).id];
      vi.useRealTimers();
      expect((await transactions.search()).map((t) => t.id)).toEqual([...ids].sort().reverse());
    });

    it('filters by period (inclusive)', async () => {
      await expense(1, '2026-10-31');
      await expense(2, '2026-11-01');
      await expense(3, '2026-11-30');
      await expense(4, '2026-12-01');
      const result = await transactions.search({ from: '2026-11-01', to: '2026-11-30' });
      expect(result.map((t) => t.amountCents)).toEqual([3, 2]);
    });

    it('filters by account, as source or destination', async () => {
      await expense(1, '2026-11-01');
      await expense(2, '2026-11-02', { accountId: cash.id });
      await transactions.create({
        type: 'transfer',
        amountCents: 3,
        accountId: checking.id,
        toAccountId: cash.id,
        date: '2026-11-03',
      });
      const result = await transactions.search({ accountIds: [cash.id] });
      expect(result.map((t) => t.amountCents)).toEqual([3, 2]);
    });

    it('filters by category including its subcategories', async () => {
      await expense(1, '2026-11-01', { categoryId: home.id });
      await expense(2, '2026-11-02', { categoryId: rent.id });
      await expense(3, '2026-11-03', { categoryId: groceries.id });
      expect((await transactions.search({ categoryIds: [home.id] })).map((t) => t.amountCents)).toEqual([2, 1]);
      expect((await transactions.search({ categoryIds: [rent.id] })).map((t) => t.amountCents)).toEqual([2]);
    });

    it('filters by type and by tag', async () => {
      const tagged = await expense(1, '2026-11-01');
      await transactions.create({
        type: 'income',
        amountCents: 2,
        accountId: checking.id,
        categoryId: salary.id,
        date: '2026-11-02',
      });
      const tag = await tags.findOrCreate('lavoro');
      await tags.setTransactionTags(tagged.id, [tag.id]);

      expect((await transactions.search({ types: ['income'] })).map((t) => t.amountCents)).toEqual([2]);
      expect((await transactions.search({ tagIds: [tag.id] })).map((t) => t.amountCents)).toEqual([1]);

      await tags.setTransactionTags(tagged.id, []);
      expect(await transactions.search({ tagIds: [tag.id] })).toEqual([]);
    });

    it('searches text in note and payee, treating % and _ literally', async () => {
      await expense(1, '2026-11-01', { payee: 'Esselunga' });
      await expense(2, '2026-11-02', { note: 'Spesa per la CENA' });
      await expense(3, '2026-11-03', { note: 'sconto 50%' });
      await expense(4, '2026-11-04', { note: 'sconto 50 euro' });

      expect((await transactions.search({ text: 'esse' })).map((t) => t.amountCents)).toEqual([1]);
      expect((await transactions.search({ text: 'cena' })).map((t) => t.amountCents)).toEqual([2]);
      expect((await transactions.search({ text: '50%' })).map((t) => t.amountCents)).toEqual([3]);
    });

    it('ignores empty filter arrays', async () => {
      await expense(1, '2026-11-01');
      expect(
        await transactions.search({ accountIds: [], categoryIds: [], types: [], tagIds: [], text: ' ' }),
      ).toHaveLength(1);
    });
  });

  describe('aggregates', () => {
    beforeEach(async () => {
      await expense(3820, '2026-11-15');
      await expense(2700, '2026-11-14', { accountId: cash.id });
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
        toAccountId: cash.id,
        date: '2026-11-13',
      });
      const deleted = await expense(99999, '2026-11-13');
      await transactions.softDelete(deleted.id);
    });

    it('summarizes count and net amount, transfers excluded from the net', async () => {
      expect(await transactions.summarize()).toEqual({ count: 4, netCents: 200000 - 3820 - 2700 });
      expect(await transactions.summarize({ types: ['expense'] })).toEqual({ count: 2, netCents: -6520 });
    });

    it('returns the net amount per day', async () => {
      expect(await transactions.netByDate()).toEqual(
        new Map([
          ['2026-11-15', -3820],
          ['2026-11-14', -2700],
          ['2026-11-13', 200000],
        ]),
      );
    });

    it('totals movements per account and direction', async () => {
      const movements = await transactions.movementsByAccount();
      expect(movements.get(checking.id)).toEqual({
        incomeCents: 200000,
        expenseCents: 3820,
        transferOutCents: 10000,
        transferInCents: 0,
      });
      expect(movements.get(cash.id)).toEqual({
        incomeCents: 0,
        expenseCents: 2700,
        transferOutCents: 0,
        transferInCents: 10000,
      });
    });

    it('counts usage per category since a date', async () => {
      expect(await transactions.countByCategorySince('2026-11-14')).toEqual(new Map([[groceries.id, 2]]));
    });

    it('counts transactions per account and per category', async () => {
      expect(await transactions.countByAccount(cash.id)).toBe(2);
      expect(await transactions.countByCategory(groceries.id)).toBe(2);
      expect(await transactions.countByCategory(rent.id)).toBe(0);
    });
  });

  it('reassigns every transaction of a category, deleted ones included', async () => {
    const active = await expense(1, '2026-11-01', { categoryId: rent.id });
    const deleted = await expense(2, '2026-11-02', { categoryId: rent.id });
    await transactions.softDelete(deleted.id);

    expect(await transactions.reassignCategory(rent.id, home.id)).toBe(2);
    expect((await transactions.findById(active.id))?.categoryId).toBe(home.id);
    await transactions.restore(deleted.id);
    expect((await transactions.findById(deleted.id))?.categoryId).toBe(home.id);
  });
});

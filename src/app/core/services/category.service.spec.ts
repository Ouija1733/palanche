import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { Account } from '../models/account';
import type { Category } from '../models/category';
import { AccountsRepository } from '../repositories/accounts.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let categories: CategoriesRepository;
  let transactions: TransactionsRepository;
  let account: Account;
  let home: Category;
  let food: Category;

  beforeEach(async () => {
    await setUpTestDatabase();
    service = TestBed.inject(CategoryService);
    categories = TestBed.inject(CategoriesRepository);
    transactions = TestBed.inject(TransactionsRepository);
    account = await TestBed.inject(AccountsRepository).create({ name: 'Conto', type: 'checking' });
    home = await service.create({ name: 'Casa', kind: 'expense', icon: 'home-outline', color: 'violet' });
    food = await service.create({ name: 'Spesa', kind: 'expense', icon: 'cart-outline', color: 'teal' });
  });

  const spend = (categoryId: string, date = '2026-11-10') =>
    transactions.create({ type: 'expense', amountCents: 100, accountId: account.id, categoryId, date });

  describe('create', () => {
    it('makes subcategories inherit kind, icon and color', async () => {
      const rent = await service.create({
        name: ' Affitto ',
        kind: 'expense',
        icon: 'cart-outline',
        color: 'red',
        parentId: home.id,
      });
      expect(rent).toEqual(
        expect.objectContaining({ name: 'Affitto', parentId: home.id, icon: 'home-outline', color: 'violet' }),
      );
    });

    it('allows at most two levels and the same kind', async () => {
      const rent = await service.create({ ...home, name: 'Affitto', parentId: home.id });
      await expect(service.create({ ...home, name: 'Deep', parentId: rent.id })).rejects.toMatchObject({
        code: 'CATEGORY_TOO_DEEP',
      });
      await expect(service.create({ ...home, name: 'Bonus', kind: 'income', parentId: home.id })).rejects.toMatchObject(
        { code: 'CATEGORY_KIND_MISMATCH' },
      );
      await expect(service.create({ ...home, name: '  ' })).rejects.toMatchObject({ code: 'INVALID_NAME' });
    });
  });

  it('builds the tree of a kind', async () => {
    const rent = await service.create({ ...home, name: 'Affitto', parentId: home.id });
    await service.create({ name: 'Stipendio', kind: 'income', icon: 'briefcase-outline', color: 'teal' });

    const tree = await service.getTree('expense');
    expect(tree.map((node) => [node.category.name, node.children.map((c) => c.id)])).toEqual([
      ['Casa', [rent.id]],
      ['Spesa', []],
    ]);
  });

  describe('update', () => {
    it('propagates icon and color of a main category to its subcategories', async () => {
      const rent = await service.create({ ...home, name: 'Affitto', parentId: home.id });
      await service.update(home.id, { icon: 'bed-outline', color: 'indigo' });
      expect(await categories.findById(rent.id)).toEqual(
        expect.objectContaining({ icon: 'bed-outline', color: 'indigo' }),
      );
    });

    it('only renames a subcategory', async () => {
      const rent = await service.create({ ...home, name: 'Affitto', parentId: home.id });
      const updated = await service.update(rent.id, { name: 'Mutuo', icon: 'cart-outline', color: 'red' });
      expect(updated).toEqual(expect.objectContaining({ name: 'Mutuo', icon: 'home-outline', color: 'violet' }));
    });
  });

  describe('move', () => {
    it('moves a main category under another one, taking its appearance', async () => {
      await service.move(food.id, home.id);
      expect(await categories.findById(food.id)).toEqual(
        expect.objectContaining({ parentId: home.id, icon: 'home-outline', color: 'violet' }),
      );
      await service.move(food.id, null);
      expect((await categories.findById(food.id))?.parentId).toBeNull();
    });

    it('refuses moves that would create three levels or mix kinds', async () => {
      await service.create({ ...home, name: 'Affitto', parentId: home.id });
      await expect(service.move(home.id, food.id)).rejects.toMatchObject({ code: 'CATEGORY_TOO_DEEP' });
      await expect(service.move(home.id, home.id)).rejects.toMatchObject({ code: 'CATEGORY_SAME' });
      const salary = await service.create({
        name: 'Stipendio',
        kind: 'income',
        icon: 'briefcase-outline',
        color: 'teal',
      });
      await expect(service.move(salary.id, home.id)).rejects.toMatchObject({ code: 'CATEGORY_KIND_MISMATCH' });
    });
  });

  describe('merge', () => {
    it('moves transactions and subcategories to the target and deletes the source', async () => {
      const rent = await service.create({ ...home, name: 'Affitto', parentId: home.id });
      const used = await spend(home.id);

      await service.merge(home.id, food.id);

      expect(await categories.findById(home.id)).toBeNull();
      expect((await transactions.findById(used.id))?.categoryId).toBe(food.id);
      expect(await categories.findById(rent.id)).toEqual(
        expect.objectContaining({ parentId: food.id, icon: 'cart-outline', color: 'teal' }),
      );
    });

    it('is all or nothing', async () => {
      const used = await spend(home.id);
      vi.spyOn(categories, 'softDelete').mockRejectedValueOnce(new Error('boom'));

      await expect(service.merge(home.id, food.id)).rejects.toThrow('boom');
      expect((await transactions.findById(used.id))?.categoryId).toBe(home.id);
      expect(await categories.findById(home.id)).not.toBeNull();
    });

    it('refuses invalid merges', async () => {
      const rent = await service.create({ ...home, name: 'Affitto', parentId: home.id });
      const shop = await service.create({ ...food, name: 'Mercato', parentId: food.id });
      await expect(service.merge(home.id, home.id)).rejects.toMatchObject({ code: 'CATEGORY_SAME' });
      await expect(service.merge(home.id, rent.id)).rejects.toMatchObject({ code: 'CATEGORY_SAME' });
      await expect(service.merge(home.id, shop.id)).rejects.toMatchObject({ code: 'CATEGORY_TOO_DEEP' });
    });
  });

  describe('delete', () => {
    it('deletes an unused category and restores it', async () => {
      await service.delete(food.id);
      expect(await categories.findById(food.id)).toBeNull();
      await service.restore(food.id);
      expect(await categories.findById(food.id)).not.toBeNull();
    });

    it('refuses categories in use or with subcategories', async () => {
      await spend(food.id);
      await service.create({ ...home, name: 'Affitto', parentId: home.id });
      await expect(service.delete(food.id)).rejects.toMatchObject({ code: 'CATEGORY_IN_USE' });
      await expect(service.delete(home.id)).rejects.toMatchObject({ code: 'CATEGORY_HAS_CHILDREN' });
    });
  });

  describe('getMostUsed', () => {
    const now = new Date(2026, 10, 15);

    it('puts the most used first, then fills with main categories', async () => {
      const rent = await service.create({ ...home, name: 'Affitto', parentId: home.id });
      const bills = await service.create({ name: 'Bollette', kind: 'expense', icon: 'flash-outline', color: 'ochre' });
      await spend(rent.id);
      await spend(rent.id);
      await spend(bills.id);
      await spend(food.id, '2026-01-01'); // older than 90 days: ignored

      const result = await service.getMostUsed('expense', 3, now);
      expect(result.map((c) => c.name)).toEqual(['Affitto', 'Bollette', 'Casa']);
    });

    it('works without any transaction', async () => {
      expect((await service.getMostUsed('expense', 7, now)).map((c) => c.name)).toEqual(['Casa', 'Spesa']);
    });
  });
});

import type { TransactionListItem } from '../../core/models/transaction';

import { groupByDay } from './group-by-day';

function item(id: string, date: string): TransactionListItem {
  return {
    id,
    type: 'expense',
    amountCents: 100,
    accountId: 'a1',
    toAccountId: null,
    categoryId: 'c1',
    date,
    payee: null,
    note: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    accountName: 'Conto',
    toAccountName: null,
    categoryName: 'Spesa',
    parentCategoryName: null,
    categoryIcon: 'cart-outline',
    categoryColor: 'teal',
    tags: [],
  };
}

describe('groupByDay', () => {
  it('returns no groups for no transactions', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('groups consecutive transactions of the same day, in order', () => {
    const groups = groupByDay([
      item('a', '2026-11-15'),
      item('b', '2026-11-14'),
      item('c', '2026-11-14'),
      item('d', '2026-11-10'),
    ]);
    expect(groups.map((g) => [g.date, g.items.map((i) => i.id)])).toEqual([
      ['2026-11-15', ['a']],
      ['2026-11-14', ['b', 'c']],
      ['2026-11-10', ['d']],
    ]);
  });
});

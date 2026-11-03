import type { TransactionListItem } from '../../core/models/transaction';

import { transactionSubtitle, transactionTitle } from './transaction-text';

const base: TransactionListItem = {
  id: 't1',
  type: 'expense',
  amountCents: 3820,
  accountId: 'a1',
  toAccountId: null,
  categoryId: 'c1',
  date: '2026-11-15',
  payee: null,
  note: null,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  accountName: 'Conto corrente',
  toAccountName: null,
  categoryName: 'Spesa',
  parentCategoryName: null,
  categoryIcon: 'cart-outline',
  categoryColor: 'teal',
  tags: [],
};

describe('transaction texts', () => {
  it('uses the payee as title and shows category and account below', () => {
    const item = { ...base, payee: 'Esselunga' };
    expect(transactionTitle(item)).toBe('Esselunga');
    expect(transactionSubtitle(item)).toBe('Spesa · Conto corrente');
  });

  it('falls back to the note, then to the category without repeating it', () => {
    expect(transactionTitle({ ...base, note: 'Pane' })).toBe('Pane');
    expect(transactionTitle(base)).toBe('Spesa');
    expect(transactionSubtitle(base)).toBe('Conto corrente');
  });

  it('adds extra parts and tags', () => {
    const item = { ...base, payee: 'Leroy Merlin', tags: ['lampadine'] };
    expect(transactionSubtitle(item, ['Oggi'])).toBe('Spesa · Conto corrente · Oggi · #lampadine');
  });

  it('describes transfers with both accounts', () => {
    const transfer: TransactionListItem = {
      ...base,
      type: 'transfer',
      categoryId: null,
      categoryName: null,
      toAccountId: 'a2',
      toAccountName: 'Prepagata',
      accountName: 'Corrente',
    };
    expect(transactionTitle(transfer)).toBe('Trasferimento');
    expect(transactionTitle({ ...transfer, note: 'Ricarica prepagata' })).toBe('Ricarica prepagata');
    expect(transactionSubtitle(transfer)).toBe('Trasferimento · Corrente → Prepagata');
  });
});

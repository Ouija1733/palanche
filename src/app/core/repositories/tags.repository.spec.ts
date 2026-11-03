import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { SqlExecutor } from '../db/sql-executor';

import { AccountsRepository } from './accounts.repository';
import { TagsRepository } from './tags.repository';
import { TransactionsRepository } from './transactions.repository';

describe('TagsRepository', () => {
  let db: SqlExecutor;
  let tags: TagsRepository;
  let transactionId: string;

  beforeEach(async () => {
    db = await setUpTestDatabase();
    tags = TestBed.inject(TagsRepository);
    const account = await TestBed.inject(AccountsRepository).create({ name: 'Contanti', type: 'cash' });
    const transaction = await TestBed.inject(TransactionsRepository).create({
      type: 'expense',
      amountCents: 450,
      accountId: account.id,
      date: '2026-11-14',
    });
    transactionId = transaction.id;
  });

  it('finds an existing tag ignoring case and spaces', async () => {
    const created = await tags.findOrCreate('Lampadine');
    expect(await tags.findOrCreate('  lampadine ')).toEqual(created);
    expect(await tags.findAll()).toHaveLength(1);
  });

  it('rejects empty names', async () => {
    await expect(tags.findOrCreate('   ')).rejects.toThrow(/empty/);
  });

  it('sets, changes and clears the tags of a transaction', async () => {
    const [home, holiday, gift] = await Promise.all(['casa', 'vacanze', 'regalo'].map((n) => tags.findOrCreate(n)));

    await tags.setTransactionTags(transactionId, [home.id, holiday.id]);
    expect((await tags.findByTransaction(transactionId)).map((t) => t.name)).toEqual(['casa', 'vacanze']);

    await tags.setTransactionTags(transactionId, [holiday.id, gift.id, gift.id]);
    expect((await tags.findByTransaction(transactionId)).map((t) => t.name)).toEqual(['regalo', 'vacanze']);

    await tags.setTransactionTags(transactionId, []);
    expect(await tags.findByTransaction(transactionId)).toEqual([]);
  });

  it('keeps unchanged links and soft-deletes removed ones', async () => {
    const [home, holiday] = await Promise.all(['casa', 'vacanze'].map((n) => tags.findOrCreate(n)));
    await tags.setTransactionTags(transactionId, [home.id, holiday.id]);
    const before = await db.query<{ id: string }>('SELECT id FROM transaction_tags WHERE tag_id = ?', [home.id]);

    await tags.setTransactionTags(transactionId, [home.id]);

    const rows = await db.query<{ id: string; tag_id: string; deleted_at: string | null }>(
      'SELECT id, tag_id, deleted_at FROM transaction_tags ORDER BY created_at',
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.tag_id === home.id)).toEqual(
      expect.objectContaining({ id: before[0].id, deleted_at: null }),
    );
    expect(rows.find((r) => r.tag_id === holiday.id)?.deleted_at).not.toBeNull();
  });
});

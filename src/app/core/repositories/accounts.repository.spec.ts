import { TestBed } from '@angular/core/testing';

import { createMigratedTestExecutor } from '../../../testing/sqljs-executor';
import { DatabaseService } from '../db/database.service';
import type { SqlExecutor } from '../db/sql-executor';
import { isUuidV4 } from '../utils/uuid';

import { AccountsRepository } from './accounts.repository';

describe('AccountsRepository', () => {
  let db: SqlExecutor;
  let repository: AccountsRepository;

  beforeEach(async () => {
    // A real SQLite database in memory, with the real migrations applied.
    db = await createMigratedTestExecutor();
    TestBed.configureTestingModule({
      providers: [{ provide: DatabaseService, useValue: { db } satisfies Pick<DatabaseService, 'db'> }],
    });
    repository = TestBed.inject(AccountsRepository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an account with defaults, a UUID and timestamps', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-03T10:00:00Z'), toFake: ['Date'] });

    const account = await repository.create({ name: 'Conto corrente', type: 'checking' });

    expect(isUuidV4(account.id)).toBe(true);
    expect(account).toEqual({
      id: account.id,
      name: 'Conto corrente',
      type: 'checking',
      currency: 'EUR',
      initialBalanceCents: 0,
      archived: false,
      sortOrder: 0,
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:00.000Z',
      deletedAt: null,
    });
    expect(await repository.findById(account.id)).toEqual(account);
  });

  it('lists active accounts by sort order, then name', async () => {
    await repository.create({ name: 'Risparmi', type: 'savings', sortOrder: 2 });
    await repository.create({ name: 'contanti', type: 'cash', sortOrder: 1 });
    await repository.create({ name: 'Carta', type: 'card', sortOrder: 1 });

    const names = (await repository.findAll()).map((account) => account.name);
    expect(names).toEqual(['Carta', 'contanti', 'Risparmi']);
  });

  it('hides archived accounts unless requested', async () => {
    const account = await repository.create({ name: 'Vecchia carta', type: 'card' });
    await repository.update(account.id, { archived: true });

    expect(await repository.findAll()).toEqual([]);
    expect(await repository.findAll({ includeArchived: true })).toEqual([
      expect.objectContaining({ id: account.id, archived: true }),
    ]);
  });

  it('updates only the given fields and bumps updated_at', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-03T10:00:00Z'), toFake: ['Date'] });
    const account = await repository.create({ name: 'Contanti', type: 'cash', initialBalanceCents: 5000 });

    vi.setSystemTime(new Date('2026-11-04T08:00:00Z'));
    const updated = await repository.update(account.id, { name: 'Portafoglio', initialBalanceCents: 8650 });

    expect(updated).toEqual({
      ...account,
      name: 'Portafoglio',
      initialBalanceCents: 8650,
      updatedAt: '2026-11-04T08:00:00.000Z',
    });
  });

  it('throws when updating a missing or deleted account', async () => {
    await expect(repository.update('missing', { name: 'X' })).rejects.toThrow(/not found/);

    const account = await repository.create({ name: 'Contanti', type: 'cash' });
    await repository.softDelete(account.id);
    await expect(repository.update(account.id, { name: 'X' })).rejects.toThrow(/not found/);
  });

  it('soft-deletes: the row stays in the table but is no longer returned', async () => {
    const account = await repository.create({ name: 'Contanti', type: 'cash' });

    expect(await repository.softDelete(account.id)).toBe(true);
    expect(await repository.findById(account.id)).toBeNull();
    expect(await repository.findAll({ includeArchived: true })).toEqual([]);

    const rows = await db.query<{ deleted_at: string | null }>('SELECT deleted_at FROM accounts WHERE id = ?', [
      account.id,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).not.toBeNull();

    expect(await repository.softDelete(account.id)).toBe(false);
  });

  it('restores a soft-deleted account (undo)', async () => {
    const account = await repository.create({ name: 'Contanti', type: 'cash' });
    await repository.softDelete(account.id);

    expect(await repository.restore(account.id)).toBe(true);
    expect(await repository.findById(account.id)).toEqual(expect.objectContaining({ id: account.id, deletedAt: null }));
    expect(await repository.restore(account.id)).toBe(false);
  });

  it('rejects invalid data through the schema constraints', async () => {
    await expect(repository.create({ name: 'X', type: 'bitcoin' as never })).rejects.toThrow();
    await expect(repository.create({ name: 'X', type: 'cash', initialBalanceCents: 10.5 })).rejects.toThrow();
  });
});

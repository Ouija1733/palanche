import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { Account } from '../models/account';

import { AccountsRepository } from './accounts.repository';
import { SavingsGoalsRepository } from './savings-goals.repository';

describe('SavingsGoalsRepository', () => {
  let goals: SavingsGoalsRepository;
  let savings: Account;

  beforeEach(async () => {
    await setUpTestDatabase();
    goals = TestBed.inject(SavingsGoalsRepository);
    savings = await TestBed.inject(AccountsRepository).create({ name: 'Risparmi', type: 'savings' });
  });

  it('creates goals and lists them in order', async () => {
    const trip = await goals.create({
      name: 'Viaggio',
      targetCents: 300000,
      targetDate: '2027-06-30',
      accountId: savings.id,
    });
    const car = await goals.create({ name: 'Auto', targetCents: 800000, targetDate: null, accountId: savings.id });
    expect(trip).toEqual(expect.objectContaining({ sortOrder: 0, deletedAt: null }));
    expect(await goals.findAll()).toEqual([car, trip]);
    expect(await goals.findById(trip.id)).toEqual(trip);
  });

  it('updates the given fields only', async () => {
    const goal = await goals.create({
      name: 'Viaggio',
      targetCents: 300000,
      targetDate: '2027-06-30',
      accountId: savings.id,
    });
    const updated = await goals.update(goal.id, { targetCents: 350000, targetDate: null });
    expect(updated).toEqual(expect.objectContaining({ name: 'Viaggio', targetCents: 350000, targetDate: null }));
    await expect(goals.update('nope', { name: 'X' })).rejects.toThrow();
  });

  it('soft deletes and restores', async () => {
    const goal = await goals.create({ name: 'Viaggio', targetCents: 300000, targetDate: null, accountId: savings.id });
    expect(await goals.softDelete(goal.id)).toBe(true);
    expect(await goals.findAll()).toEqual([]);
    expect(await goals.findById(goal.id)).toBeNull();
    expect(await goals.restore(goal.id)).toBe(true);
    expect(await goals.findAll()).toHaveLength(1);
  });

  it('keeps deleted rows for the backup and can replace the table', async () => {
    await goals.create({ name: 'Viaggio', targetCents: 300000, targetDate: null, accountId: savings.id });
    const deleted = await goals.create({ name: 'Auto', targetCents: 1000, targetDate: null, accountId: savings.id });
    await goals.softDelete(deleted.id);
    const all = await goals.findAllIncludingDeleted();
    expect(all).toHaveLength(2);

    await goals.deleteAll();
    expect(await goals.findAllIncludingDeleted()).toEqual([]);
    await goals.upsertAll(all);
    expect(await goals.findAllIncludingDeleted()).toEqual(all);
  });
});

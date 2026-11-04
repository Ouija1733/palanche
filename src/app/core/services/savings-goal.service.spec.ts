import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { Account } from '../models/account';
import { AccountsRepository } from '../repositories/accounts.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

import { PreferencesService } from './preferences.service';
import { monthlyQuota, SavingsGoalService } from './savings-goal.service';

describe('monthlyQuota', () => {
  it('splits what is missing over the months left, the current and the target one included', () => {
    // 3000 € − 1200 € over November → April = 6 months.
    expect(monthlyQuota(300000, 120000, '2027-04-30', '2026-11', '2027-04')).toEqual({
      monthsLeft: 6,
      monthlyCents: 30000,
      overdue: false,
    });
  });

  it('rounds up to the cent, so the goal is reached in time', () => {
    expect(monthlyQuota(10000, 0, '2027-01-31', '2026-11', '2027-01')?.monthlyCents).toBe(3334);
  });

  it('asks for everything this month when the target is this month or already past', () => {
    expect(monthlyQuota(10000, 4000, '2026-11-30', '2026-11', '2026-11')).toEqual({
      monthsLeft: 1,
      monthlyCents: 6000,
      overdue: false,
    });
    expect(monthlyQuota(10000, 4000, '2026-09-30', '2026-11', '2026-09')).toEqual({
      monthsLeft: 1,
      monthlyCents: 6000,
      overdue: true,
    });
  });

  it('has no quota without a date or once the goal is reached', () => {
    expect(monthlyQuota(10000, 0, null, '2026-11', null)).toBeNull();
    expect(monthlyQuota(10000, 10000, '2027-04-30', '2026-11', '2027-04')).toBeNull();
    expect(monthlyQuota(10000, 12000, '2027-04-30', '2026-11', '2027-04')).toBeNull();
  });
});

describe('SavingsGoalService', () => {
  let service: SavingsGoalService;
  let accounts: AccountsRepository;
  let savings: Account;
  let checking: Account;

  const NOW = new Date(2026, 10, 15, 12, 0); // 15 November 2026

  beforeEach(async () => {
    await setUpTestDatabase();
    service = TestBed.inject(SavingsGoalService);
    accounts = TestBed.inject(AccountsRepository);
    savings = await accounts.create({ name: 'Risparmi', type: 'savings', initialBalanceCents: 100000 });
    checking = await accounts.create({ name: 'Conto', type: 'checking', initialBalanceCents: 500000 });
    // 200 € moved to savings: the savings balance is 1200 €.
    await TestBed.inject(TransactionsRepository).create({
      type: 'transfer',
      amountCents: 20000,
      accountId: checking.id,
      toAccountId: savings.id,
      date: '2026-11-05',
    });
  });

  it('shows the balance of the linked account as the progress, with the monthly quota', async () => {
    await service.create({ name: ' Viaggio ', targetCents: 300000, targetDate: '2027-04-30', accountId: savings.id });

    const [progress] = await service.list(NOW);
    expect(progress.goal.name).toBe('Viaggio');
    expect(progress).toEqual(
      expect.objectContaining({
        balanceCents: 120000,
        percent: 40,
        reached: false,
        remainingCents: 180000,
        quota: { monthsLeft: 6, monthlyCents: 30000, overdue: false },
      }),
    );
  });

  it('is reached when the balance gets to the target', async () => {
    await service.create({ name: 'Fondo', targetCents: 100000, targetDate: '2027-04-30', accountId: savings.id });
    const [progress] = await service.list(NOW);
    expect(progress).toEqual(expect.objectContaining({ percent: 100, reached: true, remainingCents: 0, quota: null }));
  });

  it('counts accounting months when the month does not start on the 1st', async () => {
    await TestBed.inject(PreferencesService).setMonthStartDay(27);
    // With start 27, 30 April 2027 belongs to "2027-05": November → May = 7 months.
    await service.create({ name: 'Viaggio', targetCents: 300000, targetDate: '2027-04-30', accountId: savings.id });
    const [progress] = await service.list(NOW);
    expect(progress.quota).toEqual({ monthsLeft: 7, monthlyCents: 25715, overdue: false });
  });

  it('accepts only active savings accounts', async () => {
    const input = { name: 'Viaggio', targetCents: 1000, targetDate: null };
    await expect(service.create({ ...input, accountId: checking.id })).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_SAVINGS',
    });
    await accounts.update(savings.id, { archived: true });
    await expect(service.create({ ...input, accountId: savings.id })).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_SAVINGS',
    });
    expect(await service.getSavingsAccounts()).toEqual([]);
  });

  it('validates name, target and date', async () => {
    const valid = { name: 'Viaggio', targetCents: 1000, targetDate: null, accountId: savings.id };
    await expect(service.create({ ...valid, name: '  ' })).rejects.toMatchObject({ code: 'INVALID_NAME' });
    await expect(service.create({ ...valid, targetCents: 0 })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(service.create({ ...valid, targetCents: 10.5 })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(service.create({ ...valid, targetDate: '2027-02-30' })).rejects.toMatchObject({
      code: 'INVALID_DATE',
    });
  });

  it('updates, deletes and restores a goal', async () => {
    const goal = await service.create({ name: 'Viaggio', targetCents: 1000, targetDate: null, accountId: savings.id });
    await service.update(goal.id, {
      name: 'Vacanze',
      targetCents: 2000,
      targetDate: '2027-01-31',
      accountId: savings.id,
    });
    expect((await service.list(NOW))[0].goal).toEqual(
      expect.objectContaining({ name: 'Vacanze', targetCents: 2000, targetDate: '2027-01-31' }),
    );
    await service.delete(goal.id);
    expect(await service.list(NOW)).toEqual([]);
    await service.restore(goal.id);
    expect(await service.list(NOW)).toHaveLength(1);
  });
});

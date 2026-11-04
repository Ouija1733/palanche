import { inject, Injectable } from '@angular/core';

import type { Account } from '../models/account';
import type { SavingsGoal } from '../models/savings-goal';
import { AccountsRepository } from '../repositories/accounts.repository';
import { SavingsGoalsRepository } from '../repositories/savings-goals.repository';
import type { IsoDate, YearMonth } from '../utils/dates';
import { accountingMonthOf, isValidIsoDate, monthsBetween, today } from '../utils/dates';

import { BalanceService } from './balance.service';
import { DataChangesService } from './data-changes.service';
import { DomainError } from './domain-error';
import { PreferencesService } from './preferences.service';

/** What the goal form sends. */
export interface SavingsGoalInput {
  name: string;
  targetCents: number;
  targetDate: IsoDate | null;
  accountId: string;
}

export interface MonthlyQuota {
  /** Accounting months left, the current one and the one of the target date included (at least 1). */
  monthsLeft: number;
  /** Amount to save each month, rounded up to the cent. */
  monthlyCents: number;
  /** The target date has passed: the whole remaining amount is due now. */
  overdue: boolean;
}

export interface SavingsGoalProgress {
  goal: SavingsGoal;
  account: Account | null;
  /** The balance of the linked account: always computed, never stored. */
  balanceCents: number;
  /** Whole percentage reached, rounded down, between 0 and 100. */
  percent: number;
  reached: boolean;
  /** How much is still missing (0 once reached). */
  remainingCents: number;
  /** null without a target date or once the goal is reached. */
  quota: MonthlyQuota | null;
}

/**
 * Monthly amount needed to reach the goal: (target − balance) / months left,
 * counting accounting months from the current one to the one that contains
 * the target date, both included.
 */
export function monthlyQuota(
  targetCents: number,
  balanceCents: number,
  targetDate: IsoDate | null,
  currentMonth: YearMonth,
  targetMonth: YearMonth | null,
): MonthlyQuota | null {
  const remaining = targetCents - balanceCents;
  if (targetDate === null || targetMonth === null || remaining <= 0) {
    return null;
  }
  const between = monthsBetween(currentMonth, targetMonth);
  const monthsLeft = Math.max(1, between + 1);
  return { monthsLeft, monthlyCents: Math.ceil(remaining / monthsLeft), overdue: between < 0 };
}

/** Savings goals: a target amount on a savings account, whose balance is the progress. */
@Injectable({ providedIn: 'root' })
export class SavingsGoalService {
  private readonly goals = inject(SavingsGoalsRepository);
  private readonly accounts = inject(AccountsRepository);
  private readonly balances = inject(BalanceService);
  private readonly preferences = inject(PreferencesService);
  private readonly changes = inject(DataChangesService);

  async list(now: Date = new Date()): Promise<SavingsGoalProgress[]> {
    const [goals, balances] = await Promise.all([
      this.goals.findAll(),
      this.balances.getBalances({ includeArchived: true }),
    ]);
    const byAccount = new Map(balances.map((balance) => [balance.account.id, balance]));
    const startDay = this.preferences.monthStartDay();
    const currentMonth = accountingMonthOf(today(now), startDay);

    return goals.map((goal) => {
      const balance = byAccount.get(goal.accountId);
      const balanceCents = balance?.balanceCents ?? 0;
      const reached = balanceCents >= goal.targetCents;
      const targetMonth = goal.targetDate ? accountingMonthOf(goal.targetDate, startDay) : null;
      return {
        goal,
        account: balance?.account ?? null,
        balanceCents,
        percent: Math.min(100, Math.max(0, Math.floor((balanceCents * 100) / goal.targetCents))),
        reached,
        remainingCents: Math.max(0, goal.targetCents - balanceCents),
        quota: monthlyQuota(goal.targetCents, balanceCents, goal.targetDate, currentMonth, targetMonth),
      };
    });
  }

  /** Accounts a goal can be linked to: active savings accounts. */
  async getSavingsAccounts(): Promise<Account[]> {
    return (await this.accounts.findAll()).filter((account) => account.type === 'savings');
  }

  async create(input: SavingsGoalInput): Promise<SavingsGoal> {
    const clean = await this.validate(input);
    const sortOrder = (await this.goals.findAll()).length;
    const goal = await this.goals.create({ ...clean, sortOrder });
    this.changes.notify();
    return goal;
  }

  async update(id: string, input: SavingsGoalInput): Promise<SavingsGoal> {
    const clean = await this.validate(input);
    const goal = await this.goals.update(id, clean);
    this.changes.notify();
    return goal;
  }

  async delete(id: string): Promise<void> {
    await this.goals.softDelete(id);
    this.changes.notify();
  }

  async restore(id: string): Promise<void> {
    await this.goals.restore(id);
    this.changes.notify();
  }

  private async validate(input: SavingsGoalInput): Promise<SavingsGoalInput> {
    const name = input.name.trim();
    if (!name) {
      throw new DomainError('INVALID_NAME', 'The goal needs a name');
    }
    if (!Number.isInteger(input.targetCents) || input.targetCents <= 0) {
      throw new DomainError('INVALID_AMOUNT', 'The target must be a positive integer amount of cents');
    }
    if (input.targetDate !== null && !isValidIsoDate(input.targetDate)) {
      throw new DomainError('INVALID_DATE', `Invalid target date: ${input.targetDate}`);
    }
    const account = await this.accounts.findById(input.accountId);
    if (!account || account.type !== 'savings' || account.archived) {
      throw new DomainError('ACCOUNT_NOT_SAVINGS', 'Goals are linked to an active savings account');
    }
    return { ...input, name };
  }
}

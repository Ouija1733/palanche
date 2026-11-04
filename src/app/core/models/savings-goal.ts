import type { IsoDate } from '../utils/dates';

/**
 * Amount to reach on a savings account. The progress is the account balance,
 * always computed.
 */
export interface SavingsGoal {
  id: string;
  name: string;
  targetCents: number;
  /** Optional deadline, "YYYY-MM-DD". */
  targetDate: IsoDate | null;
  accountId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type NewSavingsGoal = Pick<SavingsGoal, 'name' | 'targetCents' | 'targetDate' | 'accountId'> &
  Partial<Pick<SavingsGoal, 'sortOrder'>>;

export type SavingsGoalChanges = Partial<
  Pick<SavingsGoal, 'name' | 'targetCents' | 'targetDate' | 'accountId' | 'sortOrder'>
>;

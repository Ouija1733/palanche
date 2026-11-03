/** Conto corrente, contanti, carta, risparmio. */
export type AccountType = 'checking' | 'cash' | 'card' | 'savings';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** ISO 4217 code, "EUR" by default. */
  currency: string;
  /** Balance when the account was added to the app. The current balance is always computed. */
  initialBalanceCents: number;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Fields needed to create an account; the others have defaults. */
export type NewAccount = Pick<Account, 'name' | 'type'> &
  Partial<Pick<Account, 'currency' | 'initialBalanceCents' | 'sortOrder'>>;

/** Fields that can be changed after creation. */
export type AccountChanges = Partial<
  Pick<Account, 'name' | 'type' | 'currency' | 'initialBalanceCents' | 'archived' | 'sortOrder'>
>;

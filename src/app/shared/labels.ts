import type { AccountType } from '../core/models/account';
import type { TransactionType } from '../core/models/transaction-type';

/** Italian names of the account types, in the order they are offered. */
export const ACCOUNT_TYPE_LABELS: Readonly<Record<AccountType, string>> = {
  checking: 'Conto corrente',
  cash: 'Contanti',
  card: 'Carta',
  savings: 'Risparmio',
};

export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export const TRANSACTION_TYPE_LABELS: Readonly<Record<TransactionType, string>> = {
  expense: 'Spesa',
  income: 'Entrata',
  transfer: 'Trasferimento',
};

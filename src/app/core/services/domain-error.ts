/**
 * Business-rule violations. Services throw them with a stable code; the UI
 * maps the code to an Italian message, so services stay independent of the
 * interface language.
 */
export type DomainErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_DATE'
  | 'INVALID_NAME'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_HAS_TRANSACTIONS'
  | 'TRANSFER_ACCOUNTS'
  | 'CATEGORY_REQUIRED'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_KIND_MISMATCH'
  | 'CATEGORY_NOT_ALLOWED'
  | 'CATEGORY_TOO_DEEP'
  | 'CATEGORY_IN_USE'
  | 'CATEGORY_HAS_CHILDREN'
  | 'CATEGORY_SAME'
  | 'INVALID_MONTH_START_DAY';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

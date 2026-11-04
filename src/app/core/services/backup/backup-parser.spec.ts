import { BackupError } from './backup-error';
import { CURRENT_SCHEMA_VERSION } from './backup-format';
import { parseBackup } from './backup-parser';

const T = '2026-11-03T10:00:00.000Z';
const stamps = { createdAt: T, updatedAt: T, deletedAt: null };

/** A small valid backup; tests break one thing at a time. */
function validBackup(): Record<string, unknown> {
  return {
    app: 'palanche',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: T,
    accounts: [
      {
        id: 'a1',
        name: 'Conto',
        type: 'checking',
        currency: 'EUR',
        initialBalanceCents: -500,
        archived: false,
        sortOrder: 0,
        ...stamps,
      },
      {
        id: 'a2',
        name: 'Contanti',
        type: 'cash',
        currency: 'EUR',
        initialBalanceCents: 0,
        archived: true,
        sortOrder: 1,
        ...stamps,
      },
    ],
    categories: [
      {
        id: 'c1',
        parentId: null,
        name: 'Casa',
        kind: 'expense',
        icon: 'home-outline',
        color: 'violet',
        sortOrder: 0,
        ...stamps,
      },
      {
        id: 'c2',
        parentId: 'c1',
        name: 'Affitto',
        kind: 'expense',
        icon: 'home-outline',
        color: 'violet',
        sortOrder: 0,
        ...stamps,
      },
    ],
    transactions: [
      {
        id: 't1',
        type: 'expense',
        amountCents: 120000,
        accountId: 'a1',
        toAccountId: null,
        categoryId: 'c2',
        date: '2026-11-01',
        payee: null,
        note: 'Novembre',
        ...stamps,
      },
      {
        id: 't2',
        type: 'transfer',
        amountCents: 5000,
        accountId: 'a1',
        toAccountId: 'a2',
        categoryId: null,
        date: '2026-11-02',
        payee: null,
        note: null,
        ...stamps,
      },
    ],
    tags: [{ id: 'g1', name: 'casa', ...stamps }],
    transactionTags: [{ id: 'l1', transactionId: 't1', tagId: 'g1', ...stamps }],
    budgets: [
      { id: 'b1', categoryId: 'c1', month: '2026-11', amountCents: 15000, ...stamps },
      { id: 'b2', categoryId: null, month: '2026-11', amountCents: 95000, ...stamps },
      { id: 'b3', categoryId: 'c1', month: '2026-11', amountCents: 10000, ...stamps, deletedAt: T },
    ],
    savingsGoals: [
      {
        id: 's1',
        name: 'Viaggio',
        targetCents: 300000,
        targetDate: '2027-06-30',
        accountId: 'a2',
        sortOrder: 0,
        ...stamps,
      },
      { id: 's2', name: 'Fondo', targetCents: 100000, targetDate: null, accountId: 'a2', sortOrder: 1, ...stamps },
    ],
    recurringRules: [],
    categorizationRules: [],
    settings: { onboarding_completed_at: T, last_account_id: null },
  };
}

type Mutation = (backup: Record<string, any>) => void;

function expectError(mutate: Mutation, code: BackupError['code'], detail?: RegExp): void {
  const backup = validBackup();
  mutate(backup);
  try {
    parseBackup(JSON.stringify(backup));
  } catch (error) {
    expect(error).toBeInstanceOf(BackupError);
    expect((error as BackupError).code).toBe(code);
    if (detail) {
      expect((error as BackupError).message).toMatch(detail);
    }
    return;
  }
  throw new Error('Expected parseBackup to throw');
}

describe('parseBackup', () => {
  it('accepts a valid backup and returns typed rows', () => {
    const file = parseBackup(JSON.stringify(validBackup()));
    expect(file.accounts[1]).toEqual(expect.objectContaining({ id: 'a2', archived: true }));
    expect(file.transactions[1]).toEqual(expect.objectContaining({ type: 'transfer', toAccountId: 'a2' }));
    expect(file.settings).toEqual({ onboarding_completed_at: T, last_account_id: null });
    expect(file.budgets.map((b) => b.categoryId)).toEqual(['c1', null, 'c1']);
    expect(file.savingsGoals[1]).toEqual(expect.objectContaining({ id: 's2', targetDate: null }));
  });

  it('ignores unknown extra fields', () => {
    const backup = validBackup();
    (backup['accounts'] as Record<string, unknown>[])[0]['color'] = 'blue';
    const file = parseBackup(JSON.stringify(backup));
    expect(file.accounts[0]).not.toHaveProperty('color');
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('{ not json')).toThrow(expect.objectContaining({ code: 'NOT_JSON' }));
  });

  it.each<[string, Mutation]>([
    ['another app', (b) => (b['app'] = 'lanterna')],
    ['a file without the app field', (b) => delete b['app']],
  ])('rejects %s', (_label, mutate) => expectError(mutate, 'NOT_A_BACKUP'));

  it('rejects a backup from a newer version of the app', () => {
    expectError((b) => (b['schemaVersion'] = CURRENT_SCHEMA_VERSION + 1), 'NEWER_VERSION');
  });

  it.each<[string, Mutation, RegExp]>([
    ['schema version 0', (b) => (b['schemaVersion'] = 0), /schemaVersion/],
    ['a missing table', (b) => delete b['transactions'], /^transactions/],
    ['a missing field', (b) => delete b['accounts'][0]['name'], /accounts\[0\]\.name/],
    ['an unknown account type', (b) => (b['accounts'][0]['type'] = 'crypto'), /accounts\[0\]\.type/],
    ['a decimal amount', (b) => (b['transactions'][0]['amountCents'] = 12.5), /transactions\[0\]\.amountCents/],
    ['a zero amount', (b) => (b['transactions'][0]['amountCents'] = 0), /amountCents/],
    ['an amount as text', (b) => (b['transactions'][0]['amountCents'] = '1200'), /amountCents/],
    ['an impossible date', (b) => (b['transactions'][0]['date'] = '2026-02-30'), /transactions\[0\]\.date/],
    ['a timestamp as date', (b) => (b['transactions'][0]['updatedAt'] = 'ieri'), /updatedAt/],
    ['an unknown color', (b) => (b['categories'][0]['color'] = '#ff0000'), /categories\[0\]\.color/],
    ['archived as a number', (b) => (b['accounts'][0]['archived'] = 1), /archived/],
    ['a duplicate id', (b) => (b['accounts'][1]['id'] = 'a1'), /accounts\[1\]\.id/],
    ['a missing account', (b) => (b['transactions'][0]['accountId'] = 'zz'), /transactions\[0\]\.accountId/],
    ['a missing parent', (b) => (b['categories'][1]['parentId'] = 'zz'), /categories\[1\]\.parentId/],
    ['a missing tag', (b) => (b['transactionTags'][0]['tagId'] = 'zz'), /transactionTags\[0\]\.tagId/],
    ['a transfer without destination', (b) => (b['transactions'][1]['toAccountId'] = null), /toAccountId/],
    ['an expense with destination', (b) => (b['transactions'][0]['toAccountId'] = 'a2'), /toAccountId/],
    ['a transfer to itself', (b) => (b['transactions'][1]['toAccountId'] = 'a1'), /toAccountId/],
    ['a non-string setting', (b) => (b['settings']['x'] = 3), /settings\.x/],
    ['rows in a future table', (b) => (b['recurringRules'] = [{ id: 'r1' }]), /recurringRules/],
    ['a budget month with a day', (b) => (b['budgets'][0]['month'] = '2026-11-01'), /budgets\[0\]\.month/],
    ['a budget month 13', (b) => (b['budgets'][0]['month'] = '2026-13'), /budgets\[0\]\.month/],
    ['a zero budget', (b) => (b['budgets'][0]['amountCents'] = 0), /budgets\[0\]\.amountCents/],
    ['a budget of a missing category', (b) => (b['budgets'][0]['categoryId'] = 'zz'), /budgets\[0\]\.categoryId/],
    ['two active budgets for the same slot', (b) => (b['budgets'][2]['deletedAt'] = null), /budgets\[2\]/],
    ['two active totals in a month', (b) => (b['budgets'][0]['categoryId'] = null), /budgets\[1\]/],
    ['a goal of a missing account', (b) => (b['savingsGoals'][0]['accountId'] = 'zz'), /savingsGoals\[0\]\.accountId/],
    ['a goal with an impossible date', (b) => (b['savingsGoals'][0]['targetDate'] = '2027-02-30'), /targetDate/],
    ['a zero goal', (b) => (b['savingsGoals'][1]['targetCents'] = 0), /savingsGoals\[1\]\.targetCents/],
  ])('rejects %s', (_label, mutate, detail) => expectError(mutate, 'INVALID_DATA', detail));
});

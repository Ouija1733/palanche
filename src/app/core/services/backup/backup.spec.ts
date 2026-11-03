import { TestBed } from '@angular/core/testing';

import type { SqlJsExecutor } from '../../../../testing/sqljs-executor';
import { createMigratedTestExecutor } from '../../../../testing/sqljs-executor';
import { DatabaseService } from '../../db/database.service';
import type { SqlExecutor } from '../../db/sql-executor';
import { AccountsRepository } from '../../repositories/accounts.repository';
import { SettingsRepository } from '../../repositories/settings.repository';
import { TagsRepository } from '../../repositories/tags.repository';
import { TransactionsRepository } from '../../repositories/transactions.repository';
import { AccountService } from '../account.service';
import { CategoryService } from '../category.service';
import { TransactionService } from '../transaction.service';

import { BackupFilesService } from './backup-files.service';
import type { BackupFile } from './backup-format';
import { ExportService } from './export.service';
import { ImportService } from './import.service';

const TABLES = ['accounts', 'categories', 'transactions', 'tags', 'transaction_tags', 'settings'] as const;
const NOW = new Date('2026-11-15T18:00:00Z');

/** Every row of every table, in a stable order: two databases are identical iff these are equal. */
async function dumpTables(db: SqlExecutor): Promise<Record<string, unknown[]>> {
  const dump: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const key = table === 'settings' ? 'key' : 'id';
    dump[table] = await db.query(`SELECT * FROM ${table} ORDER BY ${key}`);
  }
  return dump;
}

/**
 * Realistic data with every tricky case: transfers, subcategories, tags,
 * soft-deleted rows of every kind, an archived account, a negative and a
 * very large amount, accents, emoji and quotes in the texts, settings.
 */
async function seedVariedData(): Promise<void> {
  vi.useFakeTimers({ now: new Date('2026-11-01T08:00:00Z'), toFake: ['Date'] });
  const accounts = TestBed.inject(AccountService);
  const categories = TestBed.inject(CategoryService);
  const transactions = TestBed.inject(TransactionService);

  const checking = await accounts.create({ name: 'Conto corrente', type: 'checking', initialBalanceCents: 210430 });
  const card = await accounts.create({ name: 'Carta "prepagata"', type: 'card', initialBalanceCents: -1550 });
  const old = await accounts.create({ name: 'Libretto', type: 'savings', initialBalanceCents: 9_000_000_000_00 });
  await accounts.setArchived(old.id, true);
  const unused = await accounts.create({ name: 'Da eliminare', type: 'cash' });
  await accounts.delete(unused.id);

  const home = await categories.create({ name: 'Casa', kind: 'expense', icon: 'home-outline', color: 'violet' });
  const rent = await categories.create({ ...home, name: 'Affitto o mutuo', parentId: home.id });
  const bar = await categories.create({ name: 'Bar e caffè', kind: 'expense', icon: 'cafe-outline', color: 'orange' });
  const salary = await categories.create({
    name: 'Stipendio',
    kind: 'income',
    icon: 'briefcase-outline',
    color: 'teal',
  });
  const gone = await categories.create({ name: 'Vecchia', kind: 'expense', icon: 'cart-outline', color: 'gray' });
  await categories.delete(gone.id);

  vi.setSystemTime(new Date('2026-11-02T08:00:00Z'));
  await transactions.save({
    type: 'expense',
    amountCents: 120000,
    accountId: checking.id,
    categoryId: rent.id,
    date: '2026-11-01',
    note: 'Novembre — più spese condominiali 🏠',
    tags: ['casa', 'Fisso'],
  });
  await transactions.save({
    type: 'expense',
    amountCents: 150,
    accountId: card.id,
    categoryId: bar.id,
    date: '2026-11-02',
    payee: "Caffè dell'Orso",
  });
  await transactions.save({
    type: 'income',
    amountCents: 200000,
    accountId: checking.id,
    categoryId: salary.id,
    date: '2026-11-13',
    payee: 'ACME S.p.A.',
  });
  const transfer = await transactions.save({
    type: 'transfer',
    amountCents: 10000,
    accountId: checking.id,
    toAccountId: card.id,
    date: '2026-11-13',
    tags: ['Fisso'],
  });
  vi.setSystemTime(new Date('2026-11-03T08:00:00Z'));
  await transactions.save({ ...(await transactions.getForEdit(transfer.id))!.transaction, tags: [] }, transfer.id);
  const deleted = await transactions.save({
    type: 'expense',
    amountCents: 999,
    accountId: checking.id,
    categoryId: bar.id,
    date: '2026-11-03',
    tags: ['sbagliato'],
  });
  await transactions.delete(deleted.id);
  vi.useRealTimers();
}

describe('backup export / import', () => {
  /** The DatabaseService seen by every service: switching `db` switches database. */
  const database: { db: SqlExecutor } = { db: undefined as unknown as SqlExecutor };
  let files: { share: ReturnType<typeof vi.fn>; writeSafetyBackup: ReturnType<typeof vi.fn> };
  let source: SqlJsExecutor;
  let target: SqlJsExecutor;
  let exporter: ExportService;
  let importer: ImportService;

  beforeEach(async () => {
    files = { share: vi.fn().mockResolvedValue(undefined), writeSafetyBackup: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      providers: [
        { provide: DatabaseService, useValue: database },
        { provide: BackupFilesService, useValue: files },
      ],
    });
    exporter = TestBed.inject(ExportService);
    importer = TestBed.inject(ImportService);

    source = await createMigratedTestExecutor();
    target = await createMigratedTestExecutor();
    database.db = source;
    await seedVariedData();
    await TestBed.inject(SettingsRepository).set('last_export_at', '2026-10-01T00:00:00.000Z');
  });

  afterEach(() => vi.useRealTimers());

  describe('export', () => {
    it('includes every table, deleted rows and settings', async () => {
      const file = await exporter.build(NOW);

      expect(file).toEqual(
        expect.objectContaining({
          app: 'palanche',
          schemaVersion: 1,
          exportedAt: '2026-11-15T18:00:00.000Z',
          budgets: [],
          savingsGoals: [],
          recurringRules: [],
          categorizationRules: [],
        }),
      );
      expect(file.accounts).toHaveLength(4);
      expect(file.categories).toHaveLength(5);
      expect(file.transactions).toHaveLength(5);
      expect(file.tags.map((t) => t.name).sort()).toEqual(['Fisso', 'casa', 'sbagliato']);
      expect(file.accounts.filter((a) => a.deletedAt !== null)).toHaveLength(1);
      expect(file.categories.filter((c) => c.deletedAt !== null)).toHaveLength(1);
      expect(file.transactions.filter((t) => t.deletedAt !== null)).toHaveLength(1);
      expect(file.transactionTags.filter((l) => l.deletedAt !== null)).toHaveLength(1);
      expect(file.settings).toEqual(expect.objectContaining({ last_export_at: '2026-10-01T00:00:00.000Z' }));
    });

    it('shares the pretty-printed file and records the export date', async () => {
      await exporter.exportAndShare(NOW);

      const [name, content] = files.share.mock.calls[0];
      expect(name).toMatch(/^palanche-backup-2026-11-15-\d{4}\.json$/);
      expect(JSON.parse(content).exportedAt).toBe('2026-11-15T18:00:00.000Z');
      expect(await TestBed.inject(SettingsRepository).get('last_export_at')).toBe('2026-11-15T18:00:00.000Z');
    });
  });

  describe('round-trip (export → empty database → import)', () => {
    it('restores identical data, row by row', async () => {
      const exported = await exporter.build(NOW);
      const text = exporter.serialize(exported);

      database.db = target;
      const parsed = importer.parse(text);
      await importer.replace(parsed, NOW);

      expect(await dumpTables(target)).toEqual(await dumpTables(source));
      expect(await exporter.build(NOW)).toEqual(exported);
    });

    it('keeps the file unchanged through JSON serialization', async () => {
      const exported = await exporter.build(NOW);
      expect(importer.parse(exporter.serialize(exported))).toEqual(exported);
    });

    it('restores working data: same balances and the same list', async () => {
      const transactions = TestBed.inject(TransactionsRepository);
      const before = { list: await transactions.search(), movements: await transactions.movementsByAccount() };
      const text = exporter.serialize(await exporter.build(NOW));

      database.db = target;
      await importer.replace(importer.parse(text), NOW);

      expect(await transactions.search()).toEqual(before.list);
      expect(await transactions.movementsByAccount()).toEqual(before.movements);
    });

    it('summarizes the active rows before confirming', async () => {
      const summary = importer.summarize(await exporter.build(NOW));
      expect(summary).toEqual({
        exportedAt: '2026-11-15T18:00:00.000Z',
        schemaVersion: 1,
        accounts: 3,
        categories: 4,
        transactions: 4,
        tags: 3,
      });
    });
  });

  describe('replace', () => {
    let backup: BackupFile;

    beforeEach(async () => {
      backup = importer.parse(exporter.serialize(await exporter.build(NOW)));
      database.db = target;
      await TestBed.inject(AccountService).create({ name: 'Conto del target', type: 'cash' });
    });

    it('saves a safety copy of the current data first', async () => {
      await importer.replace(backup, NOW);

      const [name, content] = files.writeSafetyBackup.mock.calls[0];
      expect(name).toMatch(/^safety-before-import-2026-11-15-\d{4}\.json$/);
      expect(JSON.parse(content).accounts.map((a: { name: string }) => a.name)).toEqual(['Conto del target']);
    });

    it('removes data that is not in the backup', async () => {
      await importer.replace(backup, NOW);
      const names = (await TestBed.inject(AccountsRepository).findAll()).map((a) => a.name);
      expect(names).not.toContain('Conto del target');
    });

    it('changes nothing if the import fails halfway', async () => {
      const before = await dumpTables(target);
      vi.spyOn(TestBed.inject(TransactionsRepository), 'upsertAll').mockRejectedValueOnce(new Error('disk full'));

      await expect(importer.replace(backup, NOW)).rejects.toThrow('disk full');
      expect(await dumpTables(target)).toEqual(before);
    });

    it('changes nothing if the safety copy cannot be written', async () => {
      const before = await dumpTables(target);
      files.writeSafetyBackup.mockRejectedValueOnce(new Error('no space'));

      await expect(importer.replace(backup, NOW)).rejects.toThrow('no space');
      expect(await dumpTables(target)).toEqual(before);
    });
  });

  describe('merge', () => {
    it('adds the backup to the existing data', async () => {
      const backup = await exporter.build(NOW);
      database.db = target;
      await TestBed.inject(AccountService).create({ name: 'Conto del target', type: 'cash' });

      const result = await importer.merge(backup);

      expect(result).toEqual({ accounts: 4, categories: 5, transactions: 5, tags: 3, transactionTags: 4 });
      const names = (await TestBed.inject(AccountsRepository).findAll({ includeArchived: true })).map((a) => a.name);
      expect(names).toEqual(expect.arrayContaining(['Conto del target', 'Conto corrente', 'Libretto']));
    });

    it('is idempotent: merging the same backup twice writes nothing the second time', async () => {
      const backup = await exporter.build(NOW);
      database.db = target;
      await importer.merge(backup);
      const afterFirst = await dumpTables(target);

      expect(await importer.merge(backup)).toEqual({
        accounts: 0,
        categories: 0,
        transactions: 0,
        tags: 0,
        transactionTags: 0,
      });
      expect(await dumpTables(target)).toEqual(afterFirst);
    });

    it('keeps the most recent version of each row, deletions included', async () => {
      const backup = await exporter.build(NOW);
      const [rentPayment] = backup.transactions.filter((t) => t.amountCents === 120000);
      const [coffee] = backup.transactions.filter((t) => t.amountCents === 150);
      const transactions = TestBed.inject(TransactionsRepository);

      // Locally (in the source database itself), one row is edited after the backup, one is older.
      vi.useFakeTimers({ now: new Date('2026-11-20T08:00:00Z'), toFake: ['Date'] });
      await transactions.update(rentPayment.id, { note: 'Modificata dopo il backup' });
      vi.useRealTimers();
      // In the backup, the coffee was edited and then deleted after the local version.
      const deletedInBackup = {
        ...coffee,
        amountCents: 180,
        updatedAt: '2026-11-21T00:00:00.000Z',
        deletedAt: '2026-11-21T00:00:00.000Z',
      };

      await importer.merge({ ...backup, transactions: [rentPayment, deletedInBackup] });

      expect((await transactions.findById(rentPayment.id))?.note).toBe('Modificata dopo il backup');
      expect(await transactions.findById(coffee.id)).toBeNull();
    });

    it('reuses a local tag with the same name instead of duplicating it', async () => {
      const backup = await exporter.build(NOW);
      database.db = target;
      const localTag = await TestBed.inject(TagsRepository).findOrCreate('FISSO');

      await importer.merge(backup);

      const tags = TestBed.inject(TagsRepository);
      expect((await tags.findAll()).map((t) => t.name).sort()).toEqual(['FISSO', 'casa', 'sbagliato']);
      const [rentPayment] = await TestBed.inject(TransactionsRepository).search({ text: 'condominiali' });
      expect(rentPayment.tags).toEqual(['casa', 'FISSO']);
      expect((await tags.findByTransaction(rentPayment.id)).map((t) => t.id)).toContain(localTag.id);
    });

    it('keeps local settings and adds the missing ones', async () => {
      const backup = await exporter.build(NOW);
      database.db = target;
      const settings = TestBed.inject(SettingsRepository);
      await settings.set('last_export_at', 'local');

      await importer.merge(backup);

      expect(await settings.get('last_export_at')).toBe('local');
      expect(await settings.get('last_account_id')).toBe(backup.settings['last_account_id']);
    });
  });
});

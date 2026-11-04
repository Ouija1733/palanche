import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../../db/database.service';
import type { SqlExecutor } from '../../db/sql-executor';
import { AccountsRepository } from '../../repositories/accounts.repository';
import { CategoriesRepository } from '../../repositories/categories.repository';
import { SettingsRepository } from '../../repositories/settings.repository';
import { TagsRepository } from '../../repositories/tags.repository';
import { TransactionsRepository } from '../../repositories/transactions.repository';
import { DataChangesService } from '../data-changes.service';

import { BackupFilesService } from './backup-files.service';
import type { BackupFile, BackupSummary } from './backup-format';
import { backupFileName, summarizeBackup } from './backup-format';
import { parseBackup } from './backup-parser';
import { ExportService } from './export.service';

/** Rows written by a merge, per table. */
export interface MergeResult {
  accounts: number;
  categories: number;
  transactions: number;
  tags: number;
  transactionTags: number;
}

interface Versioned {
  id: string;
  updatedAt: string;
}

/** Incoming rows that are new or more recent than the local version. */
function newerRows<T extends Versioned>(incoming: readonly T[], local: readonly T[]): T[] {
  const localById = new Map(local.map((row) => [row.id, row]));
  return incoming.filter((row) => {
    const existing = localById.get(row.id);
    return !existing || row.updatedAt > existing.updatedAt;
  });
}

/**
 * Restores a JSON backup. Flow: `parse` → show `summarize` → `replace` or
 * `merge`. Both write everything in one SQL transaction: if anything fails,
 * the database is left exactly as it was.
 */
@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly database = inject(DatabaseService);
  private readonly accounts = inject(AccountsRepository);
  private readonly categories = inject(CategoriesRepository);
  private readonly transactions = inject(TransactionsRepository);
  private readonly tags = inject(TagsRepository);
  private readonly settings = inject(SettingsRepository);
  private readonly exporter = inject(ExportService);
  private readonly files = inject(BackupFilesService);
  private readonly changes = inject(DataChangesService);

  /** Validates the file text (throws BackupError) and upgrades older versions. */
  parse(text: string): BackupFile {
    return parseBackup(text);
  }

  summarize(file: BackupFile): BackupSummary {
    return summarizeBackup(file);
  }

  /**
   * Makes the database identical to the backup, deleted rows included. A
   * safety copy of the current data is saved first.
   */
  async replace(file: BackupFile, now: Date = new Date()): Promise<void> {
    const current = await this.exporter.build(now);
    await this.files.writeSafetyBackup(backupFileName(now, 'safety-before-import'), this.exporter.serialize(current));

    await this.database.db.transaction(async (tx) => {
      // Children before parents, so that no foreign key is ever left dangling.
      await this.tags.deleteAll(tx);
      await this.transactions.deleteAll(tx);
      await this.categories.deleteAll(tx);
      await this.accounts.deleteAll(tx);
      await this.settings.deleteAll(tx);

      await this.writeRows(file, tx);
      await this.settings.setMany(file.settings, tx);
    });
    this.changes.notify();
  }

  /**
   * Adds the backup to the current data. Rows are matched by id: a backup row
   * wins only if its updated_at is more recent (deletions included, since
   * they are updates of deleted_at). Local settings are kept; only keys
   * missing locally are added.
   */
  async merge(file: BackupFile): Promise<MergeResult> {
    const result = await this.database.db.transaction(async (tx) => {
      const accounts = newerRows(file.accounts, await this.accounts.findAllIncludingDeleted(tx));
      const categories = newerRows(file.categories, await this.categories.findAllIncludingDeleted(tx));
      const transactions = newerRows(file.transactions, await this.transactions.findAllIncludingDeleted(tx));

      // The same tag name may exist on both sides with different ids: reuse the local tag.
      const localTags = await this.tags.findAllIncludingDeleted(tx);
      const activeLocalByName = new Map(
        localTags.filter((tag) => tag.deletedAt === null).map((tag) => [tag.name.toLocaleLowerCase('it'), tag.id]),
      );
      const tagIdMap = new Map<string, string>();
      for (const tag of file.tags) {
        const localId = activeLocalByName.get(tag.name.toLocaleLowerCase('it'));
        if (tag.deletedAt === null && localId && localId !== tag.id) {
          tagIdMap.set(tag.id, localId);
        }
      }
      const tags = newerRows(
        file.tags.filter((tag) => !tagIdMap.has(tag.id)),
        localTags,
      );

      // An active link for the same transaction and tag may already exist locally with another id: keep that one.
      const pair = (link: { transactionId: string; tagId: string }) => `${link.transactionId}|${link.tagId}`;
      const localLinks = await this.tags.findAllLinksIncludingDeleted(tx);
      const activeLocalLinkByPair = new Map(
        localLinks.filter((link) => link.deletedAt === null).map((link) => [pair(link), link.id]),
      );
      const remappedLinks = file.transactionTags.map((link) => ({
        ...link,
        tagId: tagIdMap.get(link.tagId) ?? link.tagId,
      }));
      const transactionTags = newerRows(remappedLinks, localLinks).filter((link) => {
        const localId = activeLocalLinkByPair.get(pair(link));
        return link.deletedAt !== null || localId === undefined || localId === link.id;
      });

      await this.writeRows({ accounts, categories, transactions, tags, transactionTags }, tx);

      const localSettings = await this.settings.getAll(tx);
      const missingSettings = Object.fromEntries(
        Object.entries(file.settings).filter(([key]) => !(key in localSettings)),
      );
      await this.settings.setMany(missingSettings, tx);

      return {
        accounts: accounts.length,
        categories: categories.length,
        transactions: transactions.length,
        tags: tags.length,
        transactionTags: transactionTags.length,
      };
    });
    this.changes.notify();
    return result;
  }

  /** Writes rows in foreign-key order: referenced tables first. */
  private async writeRows(
    rows: Pick<BackupFile, 'accounts' | 'categories' | 'transactions' | 'tags' | 'transactionTags'>,
    tx: SqlExecutor,
  ): Promise<void> {
    await this.accounts.upsertAll(rows.accounts, tx);
    await this.categories.upsertAll(rows.categories, tx);
    await this.tags.upsertAll(rows.tags, tx);
    await this.transactions.upsertAll(rows.transactions, tx);
    await this.tags.upsertAllLinks(rows.transactionTags, tx);
  }
}

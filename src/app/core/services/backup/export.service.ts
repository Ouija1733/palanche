import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../../db/database.service';
import { AccountsRepository } from '../../repositories/accounts.repository';
import { CategoriesRepository } from '../../repositories/categories.repository';
import { SettingsRepository } from '../../repositories/settings.repository';
import { TagsRepository } from '../../repositories/tags.repository';
import { TransactionsRepository } from '../../repositories/transactions.repository';
import { nowIso } from '../../utils/dates';

import { BackupFilesService } from './backup-files.service';
import type { BackupFile } from './backup-format';
import { BACKUP_APP, backupFileName, CURRENT_SCHEMA_VERSION } from './backup-format';

/** Builds the JSON export: the whole database, deleted rows included. */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly database = inject(DatabaseService);
  private readonly accounts = inject(AccountsRepository);
  private readonly categories = inject(CategoriesRepository);
  private readonly transactions = inject(TransactionsRepository);
  private readonly tags = inject(TagsRepository);
  private readonly settings = inject(SettingsRepository);
  private readonly files = inject(BackupFilesService);

  /** Reads every table inside one transaction, so the snapshot is consistent. */
  async build(now: Date = new Date()): Promise<BackupFile> {
    return this.database.db.transaction(async (tx) => ({
      app: BACKUP_APP,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: nowIso(now),
      accounts: await this.accounts.findAllIncludingDeleted(tx),
      categories: await this.categories.findAllIncludingDeleted(tx),
      transactions: await this.transactions.findAllIncludingDeleted(tx),
      tags: await this.tags.findAllIncludingDeleted(tx),
      transactionTags: await this.tags.findAllLinksIncludingDeleted(tx),
      budgets: [],
      savingsGoals: [],
      recurringRules: [],
      categorizationRules: [],
      settings: await this.settings.getAll(tx),
    }));
  }

  /** Pretty-printed, so the file stays readable and diffable. */
  serialize(file: BackupFile): string {
    return `${JSON.stringify(file, null, 2)}\n`;
  }

  /** Exports now and opens the Android share sheet (a download in the browser). */
  async exportAndShare(now: Date = new Date()): Promise<void> {
    const file = await this.build(now);
    await this.files.share(backupFileName(now), this.serialize(file));
    await this.settings.set('last_export_at', file.exportedAt);
  }
}

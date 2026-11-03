import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { AccountType } from '../models/account';
import type { CategoryKind } from '../models/category';
import type { CategoryColor } from '../models/category-palette';
import { AccountsRepository } from '../repositories/accounts.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { nowIso } from '../utils/dates';

import { DomainError } from './domain-error';

export interface FirstAccountInput {
  name: string;
  type: AccountType;
  initialBalanceCents: number;
}

/** A main category kept during the onboarding, possibly renamed, with the kept subcategories. */
export interface CategorySelection {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: CategoryColor;
  children: readonly string[];
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new DomainError('INVALID_NAME', 'Names cannot be empty');
  }
  return trimmed;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly database = inject(DatabaseService);
  private readonly accounts = inject(AccountsRepository);
  private readonly categories = inject(CategoriesRepository);
  private readonly settings = inject(SettingsRepository);

  async isCompleted(): Promise<boolean> {
    return (await this.settings.get('onboarding_completed_at')) !== null;
  }

  /**
   * Creates the first account and the chosen categories, and marks the
   * onboarding as done: all in one transaction, so an interrupted first
   * launch never leaves half the data behind. Categories switched off in the
   * onboarding are simply not in `categories`.
   */
  async complete(account: FirstAccountInput, categories: readonly CategorySelection[]): Promise<void> {
    if (!Number.isSafeInteger(account.initialBalanceCents)) {
      throw new DomainError('INVALID_AMOUNT', 'Initial balance must be integer cents');
    }
    const accountName = cleanName(account.name);
    const selections = categories.map((category) => ({
      ...category,
      name: cleanName(category.name),
      children: category.children.map(cleanName),
    }));

    await this.database.db.transaction(async (tx) => {
      if (await this.settings.get('onboarding_completed_at', tx)) {
        throw new Error('Onboarding already completed');
      }
      await this.accounts.create({ ...account, name: accountName, currency: 'EUR', sortOrder: 0 }, tx);

      for (const [index, selection] of selections.entries()) {
        const { children, ...main } = selection;
        const parent = await this.categories.create({ ...main, sortOrder: index }, tx);
        for (const [childIndex, childName] of children.entries()) {
          await this.categories.create({ ...main, name: childName, parentId: parent.id, sortOrder: childIndex }, tx);
        }
      }
      await this.settings.set('onboarding_completed_at', nowIso(), tx);
    });
  }
}

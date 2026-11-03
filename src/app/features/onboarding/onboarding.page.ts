import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonToggle } from '@ionic/angular';

import type { AccountType } from '../../core/models/account';
import type { CategoryKind } from '../../core/models/category';
import type { CategoryColor } from '../../core/models/category-palette';
import { DEFAULT_CATEGORIES } from '../../core/services/default-categories';
import type { CategorySelection } from '../../core/services/onboarding.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { AmountKeypadComponent } from '../../shared/amount-keypad/amount-keypad.component';
import type { KeypadKey } from '../../shared/amount-keypad/keypad-input';
import { applyKeypadKey, formatKeypadText, keypadTextToCents } from '../../shared/amount-keypad/keypad-input';
import { CategoryIconComponent } from '../../shared/category-icon/category-icon.component';
import { FilterChipComponent } from '../../shared/filter-chip/filter-chip.component';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from '../../shared/labels';
import { ToastService } from '../../shared/toast.service';

/** A default category as edited in the onboarding: it can be renamed and switched off. */
interface EditableCategory {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: CategoryColor;
  enabled: boolean;
  expanded: boolean;
  children: { name: string; enabled: boolean }[];
}

function editableDefaults(): EditableCategory[] {
  return DEFAULT_CATEGORIES.map((category) => ({
    ...category,
    enabled: true,
    expanded: false,
    children: category.children.map((name) => ({ name, enabled: true })),
  }));
}

/**
 * First launch, two steps: the first account with its initial balance, then
 * the default categories, which can be renamed or switched off. Nothing is
 * saved until "Inizia": then everything is written in one transaction.
 */
@Component({
  selector: 'app-onboarding',
  imports: [IonContent, IonIcon, IonToggle, AmountKeypadComponent, CategoryIconComponent, FilterChipComponent],
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage {
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly step = signal<1 | 2>(1);
  protected readonly saving = signal(false);

  // Step 1: first account
  protected readonly accountTypes = ACCOUNT_TYPES;
  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly accountName = signal(ACCOUNT_TYPE_LABELS.checking);
  protected readonly accountType = signal<AccountType>('checking');
  protected readonly balanceText = signal('');
  protected readonly negative = signal(false);
  protected readonly balanceLabel = computed(() => (this.negative() ? '−' : '') + formatKeypadText(this.balanceText()));

  // Step 2: categories
  protected readonly categories = signal<EditableCategory[]>(editableDefaults());
  protected readonly expenseCategories = computed(() => this.indexed('expense'));
  protected readonly incomeCategories = computed(() => this.indexed('income'));
  protected readonly enabledCount = computed(() => this.categories().filter((c) => c.enabled).length);

  protected chooseType(type: AccountType): void {
    // Keep a name typed by the user; replace only the default one.
    if (this.accountName() === ACCOUNT_TYPE_LABELS[this.accountType()]) {
      this.accountName.set(ACCOUNT_TYPE_LABELS[type]);
    }
    this.accountType.set(type);
  }

  protected typeKey(key: KeypadKey): void {
    this.balanceText.update((text) => applyKeypadKey(text, key));
  }

  protected next(): void {
    if (!this.accountName().trim()) {
      void this.toast.info('Dai un nome al conto.');
      return;
    }
    this.step.set(2);
  }

  protected updateCategory(index: number, change: Partial<EditableCategory>): void {
    this.categories.update((all) => all.map((c, i) => (i === index ? { ...c, ...change } : c)));
  }

  protected updateChild(index: number, childIndex: number, change: Partial<{ name: string; enabled: boolean }>): void {
    this.categories.update((all) =>
      all.map((c, i) =>
        i === index
          ? { ...c, children: c.children.map((child, j) => (j === childIndex ? { ...child, ...change } : child)) }
          : c,
      ),
    );
  }

  protected setAll(enabled: boolean): void {
    this.categories.update((all) => all.map((c) => ({ ...c, enabled })));
  }

  protected async start(): Promise<void> {
    const selections: CategorySelection[] = this.categories()
      .filter((c) => c.enabled)
      .map((c) => ({
        name: c.name,
        kind: c.kind,
        icon: c.icon,
        color: c.color,
        children: c.children.filter((child) => child.enabled).map((child) => child.name),
      }));
    const cents = keypadTextToCents(this.balanceText());

    this.saving.set(true);
    try {
      await this.onboarding.complete(
        { name: this.accountName(), type: this.accountType(), initialBalanceCents: this.negative() ? -cents : cents },
        selections,
      );
      await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
    } catch (error) {
      await this.toast.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Categories of a kind with their index in the full list (needed to update them). */
  private indexed(kind: CategoryKind): { category: EditableCategory; index: number }[] {
    return this.categories()
      .map((category, index) => ({ category, index }))
      .filter(({ category }) => category.kind === kind);
  }
}

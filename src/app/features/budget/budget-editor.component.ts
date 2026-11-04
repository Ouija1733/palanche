import type { OnInit } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonFooter, IonIcon, ModalController } from '@ionic/angular';

import type { Budget } from '../../core/models/budget';
import type { Category } from '../../core/models/category';
import { BudgetService } from '../../core/services/budget.service';
import type { YearMonth } from '../../core/utils/dates';
import { AmountKeypadComponent } from '../../shared/amount-keypad/amount-keypad.component';
import type { KeypadKey } from '../../shared/amount-keypad/keypad-input';
import {
  applyKeypadKey,
  centsToKeypadText,
  formatKeypadText,
  keypadTextToCents,
} from '../../shared/amount-keypad/keypad-input';
import { CategoryIconComponent } from '../../shared/category-icon/category-icon.component';
import { monthTitle } from '../../shared/month-labels';
import { ToastService } from '../../shared/toast.service';

/**
 * Sets, changes or removes one budget of a month, as a bottom sheet with the
 * amount keypad. With `category` null it is the total budget of the month.
 */
@Component({
  selector: 'app-budget-editor',
  imports: [IonContent, IonFooter, IonIcon, AmountKeypadComponent, CategoryIconComponent],
  template: `
    <ion-content class="sheet">
      <div class="top">
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="close()">
          <ion-icon name="close-outline" />
        </button>
        <h2>{{ budget ? 'Modifica budget' : 'Nuovo budget' }}</h2>
        <span class="icon-button" aria-hidden="true"></span>
      </div>

      <div class="subject">
        @if (category; as category) {
          <app-category-icon [icon]="category.icon" [color]="category.color" size="small" />
          <span class="name">{{ category.name }}</span>
        } @else {
          <span class="name">Budget del mese</span>
        }
        <span class="month">{{ title }}</span>
      </div>

      <div class="amount" [class.placeholder]="amountText() === ''">{{ amountLabel() }}</div>
      <p class="hint">
        @if (category) {
          Comprende le spese delle sottocategorie.
        } @else {
          Si confronta con tutte le spese del mese.
        }
      </p>

      @if (budget) {
        <button type="button" class="pal-button secondary wide danger" (click)="remove()">
          <ion-icon name="trash-outline" aria-hidden="true" />
          Togli il budget
        </button>
      }
    </ion-content>

    <ion-footer class="sheet-footer ion-no-border">
      <app-amount-keypad (pressed)="typeKey($event)" />
      <button type="button" class="pal-button wide save" [disabled]="saving() || amountText() === ''" (click)="save()">
        Salva
      </button>
    </ion-footer>
  `,
  styles: `
    .sheet {
      --background: var(--pal-surface);
      --padding-start: var(--pal-page-padding);
      --padding-end: var(--pal-page-padding);
      --padding-top: 16px;
      --padding-bottom: 8px;
    }
    .sheet-footer {
      padding: 6px var(--pal-page-padding) calc(12px + var(--ion-safe-area-bottom, 0px));
      background: var(--pal-surface);
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .top h2 {
      margin: 0;
      font-size: 20px;
      font-weight: var(--pal-font-extrabold);
    }
    .icon-button {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 0;
      background: none;
      color: var(--pal-text);
      font-size: 28px;
    }
    .subject {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .name {
      flex: 1;
      font-size: 17px;
      font-weight: var(--pal-font-bold);
    }
    .month {
      color: var(--pal-text-muted);
    }
    .amount {
      margin: 24px 0 4px;
      text-align: center;
      font-size: var(--pal-fs-amount-input);
      font-weight: var(--pal-font-extrabold);
    }
    .amount.placeholder {
      color: var(--pal-text-muted);
    }
    .hint {
      margin: 0 0 20px;
      text-align: center;
      font-size: var(--pal-fs-secondary);
      color: var(--pal-text-muted);
    }
    .danger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 48px;
      border-color: var(--pal-danger);
      color: var(--pal-danger);
      font-size: 15px;
    }
    .save {
      margin-top: 10px;
    }
  `,
})
export class BudgetEditorComponent implements OnInit {
  // Set through ModalController componentProps.
  month!: YearMonth;
  /** null for the total budget of the month. */
  category: Category | null = null;
  /** The budget to change; null to create one. */
  budget: Budget | null = null;

  private readonly modals = inject(ModalController);
  private readonly budgets = inject(BudgetService);
  private readonly toast = inject(ToastService);

  protected title = '';
  protected readonly amountText = signal('');
  protected readonly saving = signal(false);
  protected readonly amountLabel = computed(() => formatKeypadText(this.amountText()));

  ngOnInit(): void {
    this.title = monthTitle(this.month);
    if (this.budget) {
      this.amountText.set(centsToKeypadText(this.budget.amountCents));
    }
  }

  protected typeKey(key: KeypadKey): void {
    this.amountText.update((text) => applyKeypadKey(text, key));
  }

  protected close(): void {
    void this.modals.dismiss();
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.budgets.setBudget(this.month, this.category?.id ?? null, keypadTextToCents(this.amountText()));
      await this.modals.dismiss(true, 'saved');
      await this.toast.info(this.budget ? 'Budget aggiornato' : 'Budget impostato');
    } catch (error) {
      await this.toast.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const budget = this.budget;
    if (!budget) {
      return;
    }
    await this.budgets.removeBudget(budget.id);
    await this.modals.dismiss(true, 'deleted');
    await this.toast.undo('Budget tolto', async () => {
      try {
        await this.budgets.restoreBudget(budget.id);
      } catch (error) {
        await this.toast.error(error);
      }
    });
  }
}

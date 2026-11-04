import { Component, computed, inject, resource, signal } from '@angular/core';
import { IonContent, IonIcon, ModalController } from '@ionic/angular';

import type { Budget } from '../../core/models/budget';
import type { Category } from '../../core/models/category';
import type { BudgetLine } from '../../core/services/budget.service';
import { BudgetService } from '../../core/services/budget.service';
import { CategoryService } from '../../core/services/category.service';
import { DataChangesService } from '../../core/services/data-changes.service';
import { addMonths } from '../../core/utils/dates';
import { formatCentsCompact } from '../../core/utils/money';
import { BudgetProgressComponent } from '../../shared/budget-progress/budget-progress.component';
import { CategoryIconComponent } from '../../shared/category-icon/category-icon.component';
import { ChoiceService } from '../../shared/choice.service';
import { monthName } from '../../shared/month-labels';
import { MonthSelectorComponent } from '../../shared/month-selector/month-selector.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SelectedMonthService } from '../../shared/selected-month.service';
import { ToastService } from '../../shared/toast.service';

import { BudgetEditorComponent } from './budget-editor.component';

/** Value used in the "Aggiungi budget" picker for the total budget of the month. */
const TOTAL_CHOICE = '__total__';

/**
 * Budget (mockup 04): the total of the month with the "where you should be
 * today" mark, one row per category budget (most consumed first), the
 * categories with spending but no budget, and "Copia da <mese precedente>".
 */
@Component({
  selector: 'app-budget',
  imports: [
    IonContent,
    IonIcon,
    PageHeaderComponent,
    MonthSelectorComponent,
    BudgetProgressComponent,
    CategoryIconComponent,
  ],
  template: `
    <ion-content class="pal-page">
      <app-page-header title="Budget" />
      <app-month-selector [compact]="true" />

      <div class="toolbar">
        <span class="when">{{ timeLeft() }}</span>
        <button type="button" class="copy" [disabled]="busy()" (click)="copyFromPrevious()">
          <ion-icon name="copy-outline" aria-hidden="true" />
          Copia da {{ previousName() }}
        </button>
      </div>

      @if (data.hasValue()) {
        @let month = data.value();
        @if (month.total; as total) {
          <button type="button" class="pal-card pal-row-button total" (click)="editTotal(total.budget)">
            <span class="label">{{ total.budget ? 'Budget del mese' : 'Somma dei budget' }}</span>
            <span class="figures">
              <span class="spent">{{ compact(total.spentCents) }}</span>
              <span class="of">/ {{ compact(total.amountCents) }}</span>
              <span class="left" [class.over]="total.status === 'over'">
                @if (total.status === 'over') {
                  Sforato di {{ compact(-total.remainingCents) }}
                } @else {
                  {{ compact(total.remainingCents) }} residui
                }
              </span>
            </span>
            <app-budget-progress
              [spentCents]="total.spentCents"
              [amountCents]="total.amountCents"
              [pace]="month.pace"
              [thick]="true"
            />
            <span class="caption">
              {{ total.percent }}% speso
              @if (month.pace !== null) {
                · la linea indica dove dovresti essere oggi
              }
            </span>
            @if (!total.budget) {
              <span class="caption">Tocca per impostare un budget del mese, confrontato con tutte le spese.</span>
            }
          </button>
        }

        @if (month.lines.length > 0) {
          <section class="pal-card lines">
            @for (line of month.lines; track line.budget.id) {
              <button type="button" class="pal-row-button line" (click)="edit(line.category, line.budget)">
                <span class="row">
                  <span class="name">{{ line.category?.name }}</span>
                  <span class="amounts">{{ compact(line.spentCents) }} / {{ compact(line.budget.amountCents) }}</span>
                </span>
                <app-budget-progress [spentCents]="line.spentCents" [amountCents]="line.budget.amountCents" />
                <span
                  class="status"
                  [class.warning]="line.status === 'warning'"
                  [class.over]="line.status === 'over'"
                  >{{ statusText(line) }}</span
                >
              </button>
            }
          </section>
        }

        @if (!month.total) {
          <div class="pal-card pal-empty">
            <strong>Nessun budget per {{ currentName() }}</strong>
            Imposta un limite per le categorie che vuoi tenere sotto controllo, oppure copia quelli di
            {{ previousName() }}.
          </div>
        }

        <button type="button" class="pal-button secondary wide add" (click)="add()">
          <ion-icon name="add-outline" aria-hidden="true" />
          {{ month.total ? 'Aggiungi un budget' : 'Imposta il primo budget' }}
        </button>

        @if (month.unbudgeted.length > 0) {
          <h2 class="pal-section-title group">Spese senza budget</h2>
          <section class="pal-card unbudgeted">
            @for (item of month.unbudgeted; track item.category.id) {
              <button type="button" class="pal-row-button free" (click)="edit(item.category, null)">
                <app-category-icon [icon]="item.category.icon" [color]="item.category.color" size="small" />
                <span class="name">{{ item.category.name }}</span>
                <span class="amounts">{{ compact(item.spentCents) }}</span>
              </button>
            }
          </section>
        }
      }
    </ion-content>
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 4px 0 12px;
    }
    .when {
      color: var(--pal-text-muted);
    }
    .copy {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid var(--pal-border);
      border-radius: var(--pal-radius-control);
      background: var(--pal-surface);
      color: var(--pal-text);
      font: inherit;
      font-weight: var(--pal-font-semibold);
    }
    .copy ion-icon {
      font-size: 18px;
    }
    .copy:disabled {
      opacity: 0.45;
    }
    /* A card that is also a button: .pal-row-button would clear the card background. */
    .total {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 18px 16px;
      border-radius: var(--pal-radius-card);
      background: var(--pal-surface);
    }
    .label {
      color: var(--pal-text-muted);
      font-size: 15px;
    }
    .figures {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 6px;
    }
    .spent {
      font-size: var(--pal-fs-amount-balance);
      font-weight: var(--pal-font-extrabold);
      letter-spacing: -0.5px;
    }
    .of {
      color: var(--pal-text-muted);
      font-size: 17px;
    }
    .left {
      margin-left: auto;
      color: var(--pal-primary);
      font-weight: var(--pal-font-bold);
    }
    .left.over {
      color: var(--pal-danger);
    }
    .caption {
      color: var(--pal-text-muted);
      font-size: var(--pal-fs-secondary);
    }
    .lines {
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .line {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 0;
    }
    .line + .line {
      border-top: 1px solid var(--pal-border);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }
    .name {
      font-size: 16px;
      font-weight: var(--pal-font-bold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .amounts {
      flex: none;
      color: var(--pal-text-muted);
    }
    .status {
      font-size: var(--pal-fs-secondary);
      color: var(--pal-text-muted);
    }
    .status.warning {
      color: var(--pal-warning-text);
      font-weight: var(--pal-font-bold);
    }
    .status.over {
      color: var(--pal-danger);
      font-weight: var(--pal-font-bold);
    }
    .add {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: var(--pal-card-gap);
    }
    .group {
      margin: 22px 4px 8px;
    }
    .unbudgeted {
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .free {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 56px;
      padding: 6px 0;
    }
    .free + .free {
      border-top: 1px solid var(--pal-border);
    }
    .free .name {
      flex: 1;
      font-weight: var(--pal-font-semibold);
    }
  `,
})
export class BudgetPage {
  private readonly budgets = inject(BudgetService);
  private readonly categories = inject(CategoryService);
  private readonly changes = inject(DataChangesService);
  private readonly modals = inject(ModalController);
  private readonly choices = inject(ChoiceService);
  private readonly toast = inject(ToastService);
  private readonly months = inject(SelectedMonthService);

  protected readonly compact = formatCentsCompact;
  protected readonly busy = signal(false);

  // Reloads when the month changes or after any write (see DataChangesService).
  protected readonly data = resource({
    params: () => ({ month: this.months.month(), version: this.changes.version() }),
    loader: ({ params }) => this.budgets.getMonth(params.month),
  });

  protected readonly currentName = computed(() => monthName(this.months.month()));
  protected readonly previousName = computed(() => monthName(addMonths(this.months.month(), -1)));

  /** "15 giorni rimasti" in the current month; past and future months say so. */
  protected readonly timeLeft = computed(() => {
    if (this.months.isCurrent()) {
      const days = this.data.value()?.daysLeft ?? null;
      if (days === null) {
        return '';
      }
      return days === 0 ? 'Ultimo giorno' : days === 1 ? '1 giorno rimasto' : `${days} giorni rimasti`;
    }
    return this.months.month() < this.months.current() ? 'Mese concluso' : 'Mese futuro';
  });

  protected statusText(line: BudgetLine): string {
    if (line.status === 'over') {
      return `Sforato di ${formatCentsCompact(-line.remainingCents)} · ${line.percent}%`;
    }
    return `${formatCentsCompact(line.remainingCents)} residui · ${line.percent}%`;
  }

  protected async edit(category: Category | null, budget: Budget | null): Promise<void> {
    const modal = await this.modals.create({
      component: BudgetEditorComponent,
      componentProps: { month: this.months.month(), category, budget },
      cssClass: 'pal-sheet',
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: true,
    });
    await modal.present();
  }

  protected async editTotal(budget: Budget | null): Promise<void> {
    await this.edit(null, budget);
  }

  /** Picks a main expense category without a budget (or the total) and opens the editor. */
  protected async add(): Promise<void> {
    const month = this.data.value();
    const taken = new Set(month?.lines.map((line) => line.budget.categoryId));
    const free = (await this.categories.list('expense')).filter(
      (category) => category.parentId === null && !taken.has(category.id),
    );
    const options = [
      ...(month?.total?.budget ? [] : [{ value: TOTAL_CHOICE, label: 'Budget del mese (tutte le spese)' }]),
      ...free.map((category) => ({ value: category.id, label: category.name })),
    ];
    if (options.length === 0) {
      await this.toast.info('Tutte le categorie hanno già un budget');
      return;
    }
    const choice = await this.choices.pickOne('Budget per', options);
    if (choice === TOTAL_CHOICE) {
      await this.edit(null, null);
    } else if (choice) {
      await this.edit(free.find((category) => category.id === choice) ?? null, null);
    }
  }

  protected async copyFromPrevious(): Promise<void> {
    this.busy.set(true);
    try {
      const copied = await this.budgets.copyFromPreviousMonth(this.months.month());
      const from = this.previousName();
      await this.toast.info(
        copied === 0
          ? `Niente da copiare da ${from}`
          : copied === 1
            ? `Copiato 1 budget da ${from}`
            : `Copiati ${copied} budget da ${from}`,
      );
    } catch (error) {
      await this.toast.error(error);
    } finally {
      this.busy.set(false);
    }
  }
}

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import type { InfiniteScrollCustomEvent } from '@ionic/angular';
import {
  IonContent,
  IonFooter,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonList,
} from '@ionic/angular';

import type { TransactionFilter, TransactionListItem } from '../../core/models/transaction';
import type { TransactionType } from '../../core/models/transaction-type';
import { AccountService } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { DataChangesService } from '../../core/services/data-changes.service';
import { TransactionService } from '../../core/services/transaction.service';
import { formatSignedCents } from '../../core/utils/money';
import type { ChoiceOption } from '../../shared/choice.service';
import { ChoiceService } from '../../shared/choice.service';
import { dayHeading } from '../../shared/day-labels';
import { FilterChipComponent } from '../../shared/filter-chip/filter-chip.component';
import { TRANSACTION_TYPE_LABELS } from '../../shared/labels';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SummaryBarComponent } from '../../shared/summary-bar/summary-bar.component';
import { ToastService } from '../../shared/toast.service';
import { TransactionRowComponent } from '../../shared/transaction-row/transaction-row.component';

import { AddTransactionFabComponent } from './editor/add-transaction-fab.component';
import { TransactionEditorService } from './editor/transaction-editor.service';
import { groupByDay } from './group-by-day';
import type { PeriodPreset } from './period';
import { PERIOD_LABELS, PERIOD_PRESETS, periodRange } from './period';

/** Transactions loaded per page; more are loaded while scrolling. */
const PAGE_SIZE = 50;
/** Wait after the last key before searching. */
const SEARCH_DELAY_MS = 250;

/**
 * Movimenti: search, filters on one scrollable row, the list grouped by day
 * with the day totals, swipe left to delete (with "Annulla"), tap to edit,
 * and the total of the filtered transactions above the tabs.
 */
@Component({
  selector: 'app-transactions',
  imports: [
    IonContent,
    IonFooter,
    IonIcon,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    PageHeaderComponent,
    FilterChipComponent,
    TransactionRowComponent,
    SummaryBarComponent,
    AddTransactionFabComponent,
  ],
  templateUrl: './transactions.page.html',
  styleUrl: './transactions.page.scss',
})
export class TransactionsPage {
  private readonly transactionService = inject(TransactionService);
  private readonly accountService = inject(AccountService);
  private readonly categoryService = inject(CategoryService);
  private readonly changes = inject(DataChangesService);
  private readonly choices = inject(ChoiceService);
  private readonly toast = inject(ToastService);
  protected readonly editor = inject(TransactionEditorService);

  // Filters
  protected readonly period = signal<PeriodPreset>('thisMonth');
  protected readonly accounts = signal<ChoiceOption[]>([]);
  protected readonly categories = signal<ChoiceOption[]>([]);
  protected readonly tags = signal<ChoiceOption[]>([]);
  protected readonly accountIds = signal<string[]>([]);
  protected readonly categoryIds = signal<string[]>([]);
  protected readonly types = signal<TransactionType[]>([]);
  protected readonly tagIds = signal<string[]>([]);
  protected readonly searchDraft = signal('');
  private readonly searchText = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;

  // Results
  protected readonly items = signal<TransactionListItem[]>([]);
  protected readonly loaded = signal(false);
  protected readonly allLoaded = signal(false);
  protected readonly count = signal(0);
  protected readonly netCents = signal(0);
  private readonly dayTotals = signal(new Map<string, number>());
  /** Increases with every reload, so that a slow, older response is ignored. */
  private requestId = 0;
  private lastFilter: TransactionFilter | null = null;

  protected readonly periodLabel = computed(() => PERIOD_LABELS[this.period()]);
  protected readonly accountsLabel = computed(() => this.chipLabel('Conti', this.accountIds(), this.accounts()));
  protected readonly categoriesLabel = computed(() =>
    this.chipLabel('Categoria', this.categoryIds(), this.categories()),
  );
  protected readonly typesLabel = computed(() =>
    this.chipLabel(
      'Tipo',
      this.types(),
      this.types().map((type) => ({ value: type, label: TRANSACTION_TYPE_LABELS[type] })),
    ),
  );
  protected readonly tagsLabel = computed(() => this.chipLabel('Tag', this.tagIds(), this.tags()));
  /** Search or filters other than the period. */
  protected readonly hasFilters = computed(
    () =>
      this.searchText() !== '' ||
      [this.accountIds(), this.categoryIds(), this.types(), this.tagIds()].some((ids) => ids.length > 0),
  );

  protected readonly emptyHint = computed(() => {
    if (this.hasFilters()) {
      return 'Prova a cambiare la ricerca o i filtri.';
    }
    return this.period() === 'all'
      ? 'Tocca + per registrare il primo.'
      : 'Niente in questo periodo. Tocca + per aggiungere un movimento.';
  });

  protected readonly groups = computed(() =>
    groupByDay(this.items()).map((group) => ({
      ...group,
      heading: dayHeading(group.date),
      total: formatSignedCents(this.dayTotals().get(group.date) ?? 0),
    })),
  );

  private readonly filter = computed<TransactionFilter>(() => ({
    ...periodRange(this.period()),
    accountIds: this.accountIds(),
    categoryIds: this.categoryIds(),
    types: this.types(),
    tagIds: this.tagIds(),
    text: this.searchText(),
  }));

  constructor() {
    // Reload when the filter changes (back to the first page) or when the
    // data changes (keeping the transactions already loaded, so the scroll
    // position does not jump after a delete or an edit).
    effect(() => {
      const filter = this.filter();
      this.changes.version();
      untracked(() => {
        const filterChanged = filter !== this.lastFilter;
        this.lastFilter = filter;
        void this.reload(filter, !filterChanged);
        void this.loadFilterOptions();
      });
    });
  }

  protected onSearch(value: string): void {
    this.searchDraft.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchText.set(value.trim()), SEARCH_DELAY_MS);
  }

  protected clearSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchDraft.set('');
    this.searchText.set('');
  }

  protected async choosePeriod(): Promise<void> {
    const options = PERIOD_PRESETS.map((preset) => ({ value: preset, label: PERIOD_LABELS[preset] }));
    const choice = await this.choices.pickOne('Periodo', options, this.period());
    if (choice) {
      this.period.set(choice);
    }
  }

  protected async chooseAccounts(): Promise<void> {
    const ids = await this.choices.pickMany('Conti', this.accounts(), this.accountIds());
    if (ids) {
      this.accountIds.set(ids);
    }
  }

  protected async chooseCategories(): Promise<void> {
    const ids = await this.choices.pickMany('Categorie', this.categories(), this.categoryIds());
    if (ids) {
      this.categoryIds.set(ids);
    }
  }

  protected async chooseTypes(): Promise<void> {
    const options = (['expense', 'income', 'transfer'] as const).map((type) => ({
      value: type,
      label: TRANSACTION_TYPE_LABELS[type],
    }));
    const types = await this.choices.pickMany('Tipo', options, this.types());
    if (types) {
      this.types.set(types);
    }
  }

  protected async chooseTags(): Promise<void> {
    const ids = await this.choices.pickMany('Tag', this.tags(), this.tagIds());
    if (ids) {
      this.tagIds.set(ids);
    }
  }

  protected async remove(item: TransactionListItem, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    await this.transactionService.delete(item.id);
    await this.toast.undo('Movimento eliminato', () => this.transactionService.restore(item.id));
  }

  protected async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    const filter = this.filter();
    const id = this.requestId;
    const more = await this.transactionService.list(filter, { limit: PAGE_SIZE, offset: this.items().length });
    if (id === this.requestId) {
      this.items.update((items) => [...items, ...more]);
      this.allLoaded.set(more.length < PAGE_SIZE);
    }
    await event.target.complete();
  }

  private async reload(filter: TransactionFilter, keepLoaded: boolean): Promise<void> {
    const id = ++this.requestId;
    const limit = keepLoaded ? Math.max(PAGE_SIZE, this.items().length) : PAGE_SIZE;
    const [items, summary, dayTotals] = await Promise.all([
      this.transactionService.list(filter, { limit }),
      this.transactionService.summarize(filter),
      this.transactionService.netByDate(filter),
    ]);
    if (id !== this.requestId) {
      return;
    }
    this.items.set(items);
    this.count.set(summary.count);
    this.netCents.set(summary.netCents);
    this.dayTotals.set(dayTotals);
    this.allLoaded.set(items.length < limit);
    this.loaded.set(true);
  }

  /** Accounts (archived included), main categories and tags offered by the filters. */
  private async loadFilterOptions(): Promise<void> {
    const [accounts, expense, income, tags] = await Promise.all([
      this.accountService.list({ includeArchived: true }),
      this.categoryService.getTree('expense'),
      this.categoryService.getTree('income'),
      this.transactionService.getTags(),
    ]);
    this.accounts.set(accounts.map((account) => ({ value: account.id, label: account.name })));
    this.categories.set([...expense, ...income].map(({ category }) => ({ value: category.id, label: category.name })));
    this.tags.set(tags.map((tag) => ({ value: tag.id, label: `#${tag.name}` })));
  }

  /** "Conti", "Contanti" (one selected), "Conti · 2" (more selected). */
  private chipLabel(base: string, selected: readonly string[], options: readonly ChoiceOption[]): string {
    if (selected.length === 0) {
      return base;
    }
    if (selected.length === 1) {
      return options.find((option) => option.value === selected[0])?.label ?? base;
    }
    return `${base} · ${selected.length}`;
  }
}

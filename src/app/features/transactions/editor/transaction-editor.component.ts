import type { OnInit } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { DatetimeChangeEventDetail } from '@ionic/angular';
import { ActionSheetController, IonContent, IonDatetime, IonIcon, IonModal, ModalController } from '@ionic/angular';

import type { Account } from '../../../core/models/account';
import type { Category, CategoryKind } from '../../../core/models/category';
import type { TransactionType } from '../../../core/models/transaction-type';
import { AccountService } from '../../../core/services/account.service';
import { CategoryService } from '../../../core/services/category.service';
import { TransactionService } from '../../../core/services/transaction.service';
import type { IsoDate } from '../../../core/utils/dates';
import { addDays, parseIsoDate, today } from '../../../core/utils/dates';
import { AmountKeypadComponent } from '../../../shared/amount-keypad/amount-keypad.component';
import type { KeypadKey } from '../../../shared/amount-keypad/keypad-input';
import {
  applyKeypadKey,
  centsToKeypadText,
  formatKeypadText,
  keypadTextToCents,
} from '../../../shared/amount-keypad/keypad-input';
import { CategoryGridComponent } from '../../../shared/category-grid/category-grid.component';
import { TRANSACTION_TYPE_LABELS } from '../../../shared/labels';
import { ToastService } from '../../../shared/toast.service';

import { CategoryPickerComponent } from './category-picker.component';

/** Places in the quick grid: 7 categories + "Altre" make the 4×2 grid of the mockup. */
const GRID_SIZE = 7;

const shortDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

/**
 * New / edit transaction, as a full-height bottom sheet. The standard flow
 * is amount → category → Salva: type (expense), account (last used) and date
 * (today) are already filled in.
 */
@Component({
  selector: 'app-transaction-editor',
  imports: [IonContent, IonIcon, IonModal, IonDatetime, AmountKeypadComponent, CategoryGridComponent],
  templateUrl: './transaction-editor.component.html',
  styleUrl: './transaction-editor.component.scss',
})
export class TransactionEditorComponent implements OnInit {
  /** Set through ModalController componentProps: the transaction to edit, null for a new one. */
  transactionId: string | null = null;

  private readonly modals = inject(ModalController);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly transactionService = inject(TransactionService);
  private readonly accountService = inject(AccountService);
  private readonly categoryService = inject(CategoryService);
  private readonly toast = inject(ToastService);

  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly types: readonly TransactionType[] = ['expense', 'income', 'transfer'];

  // Form state
  protected readonly type = signal<TransactionType>('expense');
  protected readonly amountText = signal('');
  protected readonly categoryId = signal<string | null>(null);
  protected readonly accountId = signal<string | null>(null);
  protected readonly toAccountId = signal<string | null>(null);
  protected readonly date = signal<IsoDate>(today());
  protected readonly payee = signal('');
  protected readonly note = signal('');
  protected readonly tags = signal<string[]>([]);
  protected readonly tagDraft = signal('');
  protected readonly moreOpen = signal(false);
  protected readonly calendarOpen = signal(false);
  protected readonly saving = signal(false);

  // Data
  private readonly accounts = signal<Account[]>([]);
  private readonly categories = signal<Record<CategoryKind, Category[]>>({ expense: [], income: [] });
  private readonly mostUsed = signal<Record<CategoryKind, Category[]>>({ expense: [], income: [] });
  private readonly tagNames = signal<string[]>([]);

  // Derived state
  protected readonly isEdit = computed(() => this.transactionId !== null);
  protected readonly kind = computed<CategoryKind>(() => (this.type() === 'income' ? 'income' : 'expense'));
  protected readonly grid = computed(() => this.mostUsed()[this.kind()]);
  protected readonly selectedCategory = computed(
    () => this.categories()[this.kind()].find((c) => c.id === this.categoryId()) ?? null,
  );
  protected readonly pickedOutsideGrid = computed(
    () => this.selectedCategory() !== null && !this.grid().some((c) => c.id === this.categoryId()),
  );
  protected readonly amountLabel = computed(() => formatKeypadText(this.amountText()));
  protected readonly accountName = computed(() => this.nameOf(this.accountId()));
  protected readonly toAccountName = computed(() => this.nameOf(this.toAccountId()));
  protected readonly dateChoice = computed(() => {
    const now = today();
    return this.date() === now ? 'today' : this.date() === addDays(now, -1) ? 'yesterday' : 'other';
  });
  protected readonly dateLabel = computed(() => shortDate.format(parseIsoDate(this.date())));
  protected readonly tagSuggestions = computed(() => {
    const draft = this.tagDraft().trim().toLocaleLowerCase('it');
    const used = new Set(this.tags().map((tag) => tag.toLocaleLowerCase('it')));
    return this.tagNames()
      .filter((name) => !used.has(name.toLocaleLowerCase('it')) && name.toLocaleLowerCase('it').includes(draft))
      .slice(0, 6);
  });
  protected readonly canSave = computed(() => {
    if (this.saving() || keypadTextToCents(this.amountText()) <= 0 || !this.accountId()) {
      return false;
    }
    return this.type() === 'transfer'
      ? this.toAccountId() !== null && this.toAccountId() !== this.accountId()
      : this.categoryId() !== null;
  });

  async ngOnInit(): Promise<void> {
    const [accounts, expense, income, defaultAccountId, tagNames] = await Promise.all([
      this.accountService.list(),
      this.categoryService.list('expense'),
      this.categoryService.list('income'),
      this.transactionService.getDefaultAccountId(),
      this.transactionService.getTagNames(),
    ]);
    this.accounts.set(accounts);
    this.categories.set({ expense, income });
    this.tagNames.set(tagNames);
    this.accountId.set(defaultAccountId);
    await this.loadMostUsed();

    if (this.transactionId) {
      await this.loadForEdit(this.transactionId);
    }
  }

  protected setType(type: TransactionType): void {
    const previousKind = this.kind();
    this.type.set(type);
    if (type === 'transfer') {
      this.categoryId.set(null);
      if (!this.toAccountId() || this.toAccountId() === this.accountId()) {
        this.toAccountId.set(this.accounts().find((a) => a.id !== this.accountId())?.id ?? null);
      }
    } else if (this.kind() !== previousKind) {
      this.categoryId.set(null);
    }
  }

  protected typeKey(key: KeypadKey): void {
    this.amountText.update((text) => applyKeypadKey(text, key));
  }

  protected async pickCategory(): Promise<void> {
    const picker = await this.modals.create({
      component: CategoryPickerComponent,
      componentProps: { kind: this.kind(), selectedId: this.categoryId() },
      cssClass: 'pal-sheet',
      breakpoints: [0, 0.9],
      initialBreakpoint: 0.9,
      handle: true,
    });
    await picker.present();
    const { data, role } = await picker.onWillDismiss<Category>();
    if (role === 'selected' && data) {
      this.categoryId.set(data.id);
    }
  }

  protected async pickAccount(which: 'from' | 'to'): Promise<void> {
    const target = which === 'from' ? this.accountId : this.toAccountId;
    const sheet = await this.actionSheets.create({
      header: which === 'to' ? 'Verso il conto' : 'Conto',
      cssClass: 'pal-action-sheet',
      buttons: [
        ...this.accounts().map((account) => ({
          text: account.name,
          cssClass: account.id === target() ? 'selected' : '',
          handler: () => target.set(account.id),
        })),
        { text: 'Annulla', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  protected setDate(choice: 'today' | 'yesterday'): void {
    this.date.set(choice === 'today' ? today() : addDays(today(), -1));
  }

  protected onCalendarChange(event: CustomEvent<DatetimeChangeEventDetail>): void {
    const value = event.detail.value;
    if (typeof value === 'string') {
      this.date.set(value.slice(0, 10));
      this.calendarOpen.set(false);
    }
  }

  protected addTag(name = this.tagDraft()): void {
    const trimmed = name.trim().replace(/^#/, '');
    const exists = this.tags().some((tag) => tag.toLocaleLowerCase('it') === trimmed.toLocaleLowerCase('it'));
    if (trimmed && !exists) {
      this.tags.update((tags) => [...tags, trimmed]);
    }
    this.tagDraft.set('');
  }

  protected removeTag(name: string): void {
    this.tags.update((tags) => tags.filter((tag) => tag !== name));
  }

  protected onTagKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected close(): void {
    void this.modals.dismiss();
  }

  /** Saves; with `addAnother` the sheet stays open, ready for the next transaction. */
  protected async save(addAnother: boolean): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.addTag(); // a tag typed but not confirmed is kept
    this.saving.set(true);
    try {
      await this.transactionService.save(
        {
          type: this.type(),
          amountCents: keypadTextToCents(this.amountText()),
          accountId: this.accountId()!,
          toAccountId: this.type() === 'transfer' ? this.toAccountId() : null,
          categoryId: this.type() === 'transfer' ? null : this.categoryId(),
          date: this.date(),
          payee: this.payee(),
          note: this.note(),
          tags: this.tags(),
        },
        this.transactionId ?? undefined,
      );
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);

      if (addAnother) {
        this.resetForNext();
        await this.loadMostUsed();
        await this.toast.info('Movimento salvato');
      } else {
        await this.modals.dismiss(true, 'saved');
        await this.toast.info(this.isEdit() ? 'Movimento aggiornato' : 'Movimento salvato');
      }
    } catch (error) {
      await this.toast.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const id = this.transactionId;
    if (!id) {
      return;
    }
    await this.transactionService.delete(id);
    await this.modals.dismiss(true, 'deleted');
    await this.toast.undo('Movimento eliminato', () => this.transactionService.restore(id));
  }

  /** Keeps type, account and date: consecutive entries usually share them. */
  private resetForNext(): void {
    this.amountText.set('');
    this.categoryId.set(null);
    this.payee.set('');
    this.note.set('');
    this.tags.set([]);
    this.tagDraft.set('');
    this.moreOpen.set(false);
  }

  private async loadMostUsed(): Promise<void> {
    const [expense, income] = await Promise.all([
      this.categoryService.getMostUsed('expense', GRID_SIZE),
      this.categoryService.getMostUsed('income', GRID_SIZE),
    ]);
    this.mostUsed.set({ expense, income });
  }

  private async loadForEdit(id: string): Promise<void> {
    const editable = await this.transactionService.getForEdit(id);
    if (!editable) {
      await this.toast.info('Il movimento non esiste più.');
      await this.modals.dismiss();
      return;
    }
    const { transaction, tags } = editable;
    this.type.set(transaction.type);
    this.amountText.set(centsToKeypadText(transaction.amountCents));
    this.categoryId.set(transaction.categoryId);
    this.accountId.set(transaction.accountId);
    this.toAccountId.set(transaction.toAccountId);
    this.date.set(transaction.date);
    this.payee.set(transaction.payee ?? '');
    this.note.set(transaction.note ?? '');
    this.tags.set(tags);
    this.moreOpen.set(Boolean(transaction.payee || transaction.note || tags.length));
  }

  private nameOf(accountId: string | null): string {
    return this.accounts().find((account) => account.id === accountId)?.name ?? 'Scegli';
  }
}

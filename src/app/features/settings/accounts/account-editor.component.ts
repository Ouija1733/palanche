import type { OnInit } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonFooter, IonIcon, ModalController } from '@ionic/angular';

import type { Account, AccountType } from '../../../core/models/account';
import { AccountService } from '../../../core/services/account.service';
import { AmountKeypadComponent } from '../../../shared/amount-keypad/amount-keypad.component';
import type { KeypadKey } from '../../../shared/amount-keypad/keypad-input';
import {
  applyKeypadKey,
  centsToKeypadText,
  formatKeypadText,
  keypadTextToCents,
} from '../../../shared/amount-keypad/keypad-input';
import { FilterChipComponent } from '../../../shared/filter-chip/filter-chip.component';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from '../../../shared/labels';
import { ToastService } from '../../../shared/toast.service';

/**
 * New / edit account, as a bottom sheet: name, type and initial balance.
 * An existing account can also be archived (or restored) and, if it has no
 * transactions, deleted.
 */
@Component({
  selector: 'app-account-editor',
  imports: [IonContent, IonFooter, IonIcon, AmountKeypadComponent, FilterChipComponent],
  template: `
    <ion-content class="sheet">
      <div class="top">
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="close()">
          <ion-icon name="close-outline" />
        </button>
        <h2>{{ account ? 'Modifica conto' : 'Nuovo conto' }}</h2>
        <span class="icon-button" aria-hidden="true"></span>
      </div>

      <label class="pal-field">
        <span class="pal-label">Nome</span>
        <input
          class="pal-input"
          type="text"
          maxlength="40"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
        />
      </label>

      <div class="pal-field">
        <span class="pal-label">Tipo</span>
        <div class="pal-chips wrap">
          @for (option of types; track option) {
            <app-filter-chip [active]="option === type()" (click)="chooseType(option)">
              {{ typeLabels[option] }}
            </app-filter-chip>
          }
        </div>
      </div>

      <div class="pal-field">
        <span class="pal-label">Saldo iniziale</span>
        <div class="balance">
          <span class="amount" [class.negative]="negative()">{{ balanceLabel() }}</span>
          <app-filter-chip [active]="negative()" (click)="negative.set(!negative())">In rosso</app-filter-chip>
        </div>
        <p class="hint">Il saldo di oggi si calcola da qui, sommando i movimenti.</p>
      </div>

      @if (account) {
        <div class="manage">
          @if (account.archived || canRemove) {
            <button type="button" class="pal-button secondary" (click)="toggleArchived()">
              <ion-icon name="archive-outline" aria-hidden="true" />
              {{ account.archived ? 'Ripristina' : 'Archivia' }}
            </button>
            <button type="button" class="pal-button secondary danger" (click)="remove()">
              <ion-icon name="trash-outline" aria-hidden="true" />
              Elimina
            </button>
          } @else {
            <p class="hint">È l’unico conto attivo: per archiviarlo crea prima un altro conto.</p>
          }
        </div>
      }
    </ion-content>

    <ion-footer class="sheet-footer ion-no-border">
      <app-amount-keypad (pressed)="typeKey($event)" />
      <button type="button" class="pal-button wide save" [disabled]="saving()" (click)="save()">Salva</button>
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
    .balance {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .amount {
      font-size: var(--pal-fs-amount-balance);
      font-weight: var(--pal-font-extrabold);
    }
    .amount.negative {
      color: var(--pal-danger);
    }
    .hint {
      margin: 6px 0 0;
      font-size: var(--pal-fs-secondary);
      color: var(--pal-text-muted);
    }
    .manage {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 20px;
    }
    .manage .hint {
      grid-column: 1 / -1;
    }
    .manage .pal-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 48px;
      font-size: 15px;
    }
    .pal-button.danger {
      border-color: var(--pal-danger);
      color: var(--pal-danger);
    }
    .save {
      margin-top: 10px;
    }
  `,
})
export class AccountEditorComponent implements OnInit {
  // Set through ModalController componentProps.
  /** The account to edit; null for a new one. */
  account: Account | null = null;
  /** False when this is the only active account: it must stay. */
  canRemove = true;

  private readonly modals = inject(ModalController);
  private readonly accounts = inject(AccountService);
  private readonly toast = inject(ToastService);

  protected readonly types = ACCOUNT_TYPES;
  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;

  protected readonly name = signal('');
  protected readonly type = signal<AccountType>('checking');
  protected readonly balanceText = signal('');
  protected readonly negative = signal(false);
  protected readonly saving = signal(false);
  protected readonly balanceLabel = computed(() => (this.negative() ? '−' : '') + formatKeypadText(this.balanceText()));

  ngOnInit(): void {
    if (this.account) {
      this.name.set(this.account.name);
      this.type.set(this.account.type);
      this.balanceText.set(centsToKeypadText(Math.abs(this.account.initialBalanceCents)));
      this.negative.set(this.account.initialBalanceCents < 0);
    } else {
      this.name.set(ACCOUNT_TYPE_LABELS.checking);
    }
  }

  protected chooseType(type: AccountType): void {
    // Keep a name typed by the user; replace only the default one.
    if (this.name() === ACCOUNT_TYPE_LABELS[this.type()]) {
      this.name.set(ACCOUNT_TYPE_LABELS[type]);
    }
    this.type.set(type);
  }

  protected typeKey(key: KeypadKey): void {
    this.balanceText.update((text) => applyKeypadKey(text, key));
  }

  protected close(): void {
    void this.modals.dismiss();
  }

  protected async save(): Promise<void> {
    const cents = keypadTextToCents(this.balanceText());
    const values = {
      name: this.name(),
      type: this.type(),
      initialBalanceCents: this.negative() ? -cents : cents,
    };
    this.saving.set(true);
    try {
      if (this.account) {
        await this.accounts.update(this.account.id, values);
      } else {
        await this.accounts.create({ ...values, currency: 'EUR' });
      }
      await this.modals.dismiss(true, 'saved');
      await this.toast.info(this.account ? 'Conto aggiornato' : 'Conto creato');
    } catch (error) {
      await this.toast.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleArchived(): Promise<void> {
    const account = this.account!;
    await this.accounts.setArchived(account.id, !account.archived);
    await this.modals.dismiss(true, 'saved');
    await this.toast.info(account.archived ? 'Conto ripristinato' : 'Conto archiviato');
  }

  protected async remove(): Promise<void> {
    const account = this.account!;
    try {
      await this.accounts.delete(account.id);
      await this.modals.dismiss(true, 'deleted');
      await this.toast.undo('Conto eliminato', () => this.accounts.restore(account.id));
    } catch (error) {
      await this.toast.error(error);
    }
  }
}

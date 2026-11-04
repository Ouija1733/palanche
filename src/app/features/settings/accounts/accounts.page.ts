import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import type { ItemReorderEventDetail } from '@ionic/angular';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonList,
  IonReorder,
  IonReorderGroup,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';

import type { Account } from '../../../core/models/account';
import { AccountService } from '../../../core/services/account.service';
import type { AccountBalance } from '../../../core/services/balance.service';
import { BalanceService } from '../../../core/services/balance.service';
import { DataChangesService } from '../../../core/services/data-changes.service';
import { formatCents } from '../../../core/utils/money';
import { CategoryIconComponent } from '../../../shared/category-icon/category-icon.component';
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from '../../../shared/labels';
import { ToastService } from '../../../shared/toast.service';

import { AccountEditorComponent } from './account-editor.component';

/** Accounts: active ones (reorderable) with their balance, then the archived ones. */
@Component({
  selector: 'app-accounts',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonReorderGroup,
    IonReorder,
    NgTemplateOutlet,
    CategoryIconComponent,
  ],
  template: `
    <ion-header class="ion-no-border pal-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/settings" text="" />
        </ion-buttons>
        <ion-title>Conti</ion-title>
        @if (active().length > 1) {
          <ion-buttons slot="end">
            <button type="button" class="pal-link toolbar-link" (click)="reordering.set(!reordering())">
              {{ reordering() ? 'Fine' : 'Riordina' }}
            </button>
          </ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="pal-page">
      @if (reordering()) {
        <p class="hint">Trascina i conti per cambiare l’ordine in cui compaiono.</p>
      }
      <ion-list class="pal-list" lines="none">
        <ion-reorder-group [disabled]="!reordering()" (ionItemReorder)="onReorder($event)">
          @for (item of active(); track item.account.id) {
            <ion-item [button]="!reordering()" [detail]="false" (click)="edit(item.account)">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: item }"></ng-container>
              <ion-reorder slot="end" />
            </ion-item>
          }
        </ion-reorder-group>
      </ion-list>

      <button type="button" class="pal-button wide" (click)="edit(null)">Aggiungi conto</button>

      @if (archived().length > 0) {
        <h2 class="pal-label pal-group-title">Archiviati</h2>
        <ion-list class="pal-list" lines="none">
          @for (item of archived(); track item.account.id) {
            <ion-item button [detail]="false" (click)="edit(item.account)">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: item }"></ng-container>
            </ion-item>
          }
        </ion-list>
      }

      <ng-template #row let-item>
        <app-category-icon class="icon" [icon]="iconOf(item)" color="teal" size="small" />
        <span class="grow">
          {{ item.account.name }}
          <span class="sub">{{ labelOf(item) }}</span>
        </span>
        <span class="balance" [class.negative]="item.balanceCents < 0">{{ format(item.balanceCents) }}</span>
      </ng-template>
    </ion-content>
  `,
  styles: `
    .toolbar-link {
      padding: 0 12px;
    }
    .hint {
      margin: 0 4px 10px;
      color: var(--pal-text-muted);
    }
    .icon {
      margin-right: 14px;
    }
    .balance {
      margin-left: 12px;
      font-weight: var(--pal-font-bold);
      white-space: nowrap;
    }
    .balance.negative {
      color: var(--pal-danger);
    }
  `,
})
export class AccountsPage {
  private readonly accountService = inject(AccountService);
  private readonly balanceService = inject(BalanceService);
  private readonly changes = inject(DataChangesService);
  private readonly modals = inject(ModalController);
  private readonly toast = inject(ToastService);

  protected readonly format = formatCents;
  protected readonly reordering = signal(false);

  private readonly balances = resource({
    params: () => this.changes.version(),
    loader: () => this.balanceService.getBalances({ includeArchived: true }),
  });
  protected readonly active = computed(() => this.list().filter((item) => !item.account.archived));
  protected readonly archived = computed(() => this.list().filter((item) => item.account.archived));

  protected async edit(account: Account | null): Promise<void> {
    if (this.reordering()) {
      return;
    }
    const modal = await this.modals.create({
      component: AccountEditorComponent,
      componentProps: {
        account,
        // The last active account cannot be archived or deleted: new transactions need one.
        canRemove: !account || account.archived || this.active().length > 1,
      },
      cssClass: 'pal-sheet',
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: true,
    });
    await modal.present();
  }

  /** Ionic moves the row on screen; `complete()` returns the reordered list, which is saved. */
  protected async onReorder(event: CustomEvent<ItemReorderEventDetail>): Promise<void> {
    const reordered = event.detail.complete([...this.active()]) as AccountBalance[];
    try {
      await this.accountService.reorder(reordered.map((item) => item.account.id));
    } catch (error) {
      await this.toast.error(error);
    }
  }

  protected labelOf(item: AccountBalance): string {
    return ACCOUNT_TYPE_LABELS[item.account.type];
  }

  protected iconOf(item: AccountBalance): string {
    return ACCOUNT_TYPE_ICONS[item.account.type];
  }

  private list(): AccountBalance[] {
    return this.balances.value() ?? [];
  }
}

import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

import { BalanceService } from '../../core/services/balance.service';
import { DataChangesService } from '../../core/services/data-changes.service';
import { TransactionService } from '../../core/services/transaction.service';
import { BalanceCardComponent } from '../../shared/balance-card/balance-card.component';
import { shortDay } from '../../shared/day-labels';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { TransactionRowComponent } from '../../shared/transaction-row/transaction-row.component';
import { AddTransactionFabComponent } from '../transactions/editor/add-transaction-fab.component';
import { TransactionEditorService } from '../transactions/editor/transaction-editor.service';

/** How many transactions the home shows; the rest is in Movimenti. */
const LATEST_COUNT = 5;

/**
 * Home: total balance with the detail per account, and the latest
 * transactions. "Speso questo mese" and "Budget a rischio" arrive in phase 2.
 */
@Component({
  selector: 'app-home',
  imports: [
    IonContent,
    RouterLink,
    PageHeaderComponent,
    BalanceCardComponent,
    TransactionRowComponent,
    AddTransactionFabComponent,
  ],
  template: `
    <ion-content class="pal-page with-fab">
      <app-page-header title="Palanche" />

      @if (balances.hasValue()) {
        <app-balance-card [totalCents]="totalCents()" [balances]="balances.value()" />
      }

      <section class="pal-card latest">
        <div class="head">
          <h2 class="pal-section-title">Ultimi movimenti</h2>
          <a class="pal-link" routerLink="/tabs/transactions">Storico</a>
        </div>
        @if (latest.hasValue()) {
          @for (item of latest.value(); track item.id) {
            <button type="button" class="pal-row-button" (click)="editor.open(item.id)">
              <app-transaction-row [item]="item" [extra]="[day(item.date)]" />
            </button>
          } @empty {
            <p class="empty">Nessun movimento. Tocca + per registrare il primo.</p>
          }
        }
      </section>

      <app-add-transaction-fab slot="fixed" />
    </ion-content>
  `,
  styles: `
    .latest {
      padding-bottom: 6px;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 44px;
    }
    .pal-row-button + .pal-row-button {
      border-top: 1px solid var(--pal-border);
    }
    .empty {
      margin: 8px 0 12px;
      color: var(--pal-text-muted);
    }
  `,
})
export class HomePage {
  private readonly balanceService = inject(BalanceService);
  private readonly transactionService = inject(TransactionService);
  private readonly changes = inject(DataChangesService);
  protected readonly editor = inject(TransactionEditorService);

  // A resource runs its async loader again every time its params change:
  // depending on the data version, the home reloads after every save or delete.
  protected readonly balances = resource({
    params: () => this.changes.version(),
    loader: () => this.balanceService.getBalances(),
  });
  protected readonly latest = resource({
    params: () => this.changes.version(),
    loader: () => this.transactionService.list({}, { limit: LATEST_COUNT }),
  });

  protected readonly totalCents = computed(() =>
    (this.balances.value() ?? []).reduce((total, { balanceCents }) => total + balanceCents, 0),
  );

  protected day(date: string): string {
    return shortDay(date);
  }
}

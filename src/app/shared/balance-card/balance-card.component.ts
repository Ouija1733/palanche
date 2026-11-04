import { Component, input, signal } from '@angular/core';

import type { AccountBalance } from '../../core/services/balance.service';
import { formatCents } from '../../core/utils/money';

/** Total balance on the primary color, with a collapsible tile per account. */
@Component({
  selector: 'app-balance-card',
  template: `
    <div class="head">
      <span class="label">Saldo totale</span>
      @if (balances().length > 0) {
        <button type="button" class="pill" [attr.aria-expanded]="expanded()" (click)="expanded.set(!expanded())">
          {{ balances().length === 1 ? '1 conto' : balances().length + ' conti' }}
        </button>
      }
    </div>
    <div class="total">{{ format(totalCents()) }}</div>
    @if (expanded()) {
      <div class="accounts">
        @for (item of balances(); track item.account.id) {
          <div class="account">
            <span class="name">{{ item.account.name }}</span>
            <span class="value">{{ format(item.balanceCents) }}</span>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 20px;
      border-radius: 20px;
      background: var(--pal-primary);
      color: var(--pal-on-primary);
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 32px;
    }
    .label {
      font-size: 15px;
      font-weight: var(--pal-font-semibold);
      opacity: 0.9;
    }
    .pill {
      min-height: 32px;
      padding: 4px 14px;
      border: 0;
      border-radius: 999px;
      background: color-mix(in srgb, var(--pal-on-primary) 16%, transparent);
      color: inherit;
      font: inherit;
      font-weight: var(--pal-font-semibold);
    }
    .total {
      margin: 6px 0 2px;
      font-size: var(--pal-fs-amount-balance);
      font-weight: var(--pal-font-extrabold);
      letter-spacing: -0.5px;
    }
    /* Tiles share the row and grow to fit: one account takes the whole width. */
    .accounts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .account {
      flex: 1 1 96px;
      padding: 10px 12px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--pal-on-primary) 12%, transparent);
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .name {
      font-size: var(--pal-fs-caption);
      opacity: 0.9;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .value {
      font-weight: var(--pal-font-bold);
    }
  `,
})
export class BalanceCardComponent {
  readonly totalCents = input.required<number>();
  readonly balances = input.required<readonly AccountBalance[]>();

  protected readonly expanded = signal(true);
  protected readonly format = formatCents;
}

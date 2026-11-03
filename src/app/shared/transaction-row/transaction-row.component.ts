import { Component, computed, input } from '@angular/core';

import type { TransactionListItem } from '../../core/models/transaction';
import { formatTransactionAmount } from '../../core/utils/money';
import { CategoryIconComponent } from '../category-icon/category-icon.component';

import { transactionSubtitle, transactionTitle } from './transaction-text';

/** One transaction in a list: category icon, title, details, signed amount. */
@Component({
  selector: 'app-transaction-row',
  imports: [CategoryIconComponent],
  template: `
    <app-category-icon
      [icon]="item().categoryIcon ?? 'swap-horizontal-outline'"
      [color]="item().categoryColor"
      size="small"
    />
    <div class="texts">
      <div class="title">{{ title() }}</div>
      <div class="subtitle">{{ subtitle() }}</div>
    </div>
    <div class="amount" [class]="item().type">{{ amount() }}</div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 64px;
      padding: 10px 0;
    }
    .texts {
      flex: 1;
      min-width: 0;
    }
    .title,
    .subtitle {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .title {
      font-size: 15px;
      font-weight: var(--pal-font-semibold);
    }
    .subtitle {
      margin-top: 2px;
      font-size: var(--pal-fs-secondary);
      color: var(--pal-text-muted);
    }
    .amount {
      flex: none;
      font-size: 15px;
      font-weight: var(--pal-font-bold);
      white-space: nowrap;
    }
    .amount.income {
      color: var(--pal-primary);
    }
    .amount.transfer {
      color: var(--pal-text-muted);
    }
  `,
})
export class TransactionRowComponent {
  readonly item = input.required<TransactionListItem>();
  /** Extra parts for the details line, e.g. "Oggi". */
  readonly extra = input<readonly string[]>([]);

  protected readonly title = computed(() => transactionTitle(this.item()));
  protected readonly subtitle = computed(() => transactionSubtitle(this.item(), this.extra()));
  protected readonly amount = computed(() => formatTransactionAmount(this.item().amountCents, this.item().type));
}

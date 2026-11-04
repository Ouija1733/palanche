import { Component, computed, input } from '@angular/core';

import { formatSignedCents } from '../../core/utils/money';

/** "24 movimenti filtrati · Saldo: + € 1.341,60", shown above the tab bar. */
@Component({
  selector: 'app-summary-bar',
  template: `
    <span class="count">{{ countLabel() }}</span>
    <span class="net">Saldo: {{ netLabel() }}</span>
  `,
  styles: `
    :host {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      min-height: 52px;
      padding: 0 var(--pal-page-padding);
      background: var(--pal-surface);
      border-top: 1px solid var(--pal-border);
    }
    .count {
      color: var(--pal-text-muted);
    }
    .net {
      font-weight: var(--pal-font-bold);
      white-space: nowrap;
    }
  `,
})
export class SummaryBarComponent {
  readonly count = input.required<number>();
  readonly netCents = input.required<number>();

  protected readonly countLabel = computed(() =>
    this.count() === 1 ? '1 movimento filtrato' : `${this.count()} movimenti filtrati`,
  );
  protected readonly netLabel = computed(() => formatSignedCents(this.netCents()));
}

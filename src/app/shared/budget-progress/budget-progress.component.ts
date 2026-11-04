import { Component, computed, input } from '@angular/core';

import { budgetPercent, budgetStatus } from '../../core/services/budget.service';

/**
 * Progress bar of a budget: primary below 80%, amber from 80% to 100%, red
 * (and full) beyond. `pace` (0–1) draws the "where you should be today" mark.
 */
@Component({
  selector: 'app-budget-progress',
  template: `
    <div class="fill" [class.empty]="width() === 0" [style.width.%]="width()"></div>
    @if (paceLeft(); as left) {
      <div class="pace" [style.left.%]="left" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 10px;
      border-radius: 999px;
      background: var(--pal-track);
    }
    :host(.thick) {
      height: 14px;
    }
    .fill {
      height: 100%;
      border-radius: inherit;
      background: var(--pal-primary);
    }
    /* A visible stub even for tiny amounts, as in the mockup (3%). */
    .fill:not(.empty) {
      min-width: 10px;
    }
    :host(.warning) .fill {
      background: var(--pal-warning);
    }
    :host(.over) .fill {
      background: var(--pal-danger-fill);
    }
    .pace {
      position: absolute;
      top: -3px;
      bottom: -3px;
      width: 3px;
      margin-left: -1.5px;
      border-radius: 2px;
      background: var(--pal-text);
    }
  `,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    '[attr.aria-valuenow]': 'percent()',
    '[attr.aria-valuetext]': 'percent() + "%"',
    '[class.warning]': 'status() === "warning"',
    '[class.over]': 'status() === "over"',
    '[class.thick]': 'thick()',
  },
})
export class BudgetProgressComponent {
  readonly spentCents = input.required<number>();
  readonly amountCents = input.required<number>();
  /** Share of the period elapsed (0–1), or null for no mark. */
  readonly pace = input<number | null>(null);
  readonly thick = input(false);

  protected readonly status = computed(() => budgetStatus(this.spentCents(), this.amountCents()));
  protected readonly percent = computed(() => budgetPercent(this.spentCents(), this.amountCents()));
  protected readonly width = computed(() => Math.min(100, Math.max(0, this.percent())));
  /** Position of the pace mark in percent; null (no mark) outside the current month. */
  protected readonly paceLeft = computed(() => {
    const pace = this.pace();
    return pace === null ? null : Math.min(100, Math.max(0, pace * 100));
  });
}

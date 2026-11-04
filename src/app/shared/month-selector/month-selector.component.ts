import { Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { PreferencesService } from '../../core/services/preferences.service';
import { addMonths } from '../../core/utils/dates';
import { monthTitle, periodLabel } from '../month-labels';
import { SelectedMonthService } from '../selected-month.service';

/**
 * "‹ Novembre 2026 ›": moves the shared selected month. When the accounting
 * month does not start on the 1st, the dates of the period are shown below
 * the name ("27 ott – 26 nov"), so it is always clear what the month covers.
 */
@Component({
  selector: 'app-month-selector',
  imports: [IonIcon],
  template: `
    <button
      type="button"
      class="arrow"
      [attr.aria-label]="'Mese precedente: ' + previousTitle()"
      (click)="months.move(-1)"
    >
      <ion-icon name="chevron-back-outline" aria-hidden="true" />
    </button>
    <div class="label" aria-live="polite">
      <span class="title">{{ title() }}</span>
      @if (dates(); as dates) {
        <span class="dates">{{ dates }}</span>
      }
    </div>
    <button type="button" class="arrow" [attr.aria-label]="'Mese successivo: ' + nextTitle()" (click)="months.move(1)">
      <ion-icon name="chevron-forward-outline" aria-hidden="true" />
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 0;
    }
    .arrow {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      margin: 0 -10px;
      border: 0;
      background: none;
      color: var(--pal-text);
    }
    .arrow ion-icon {
      font-size: 24px;
    }
    .label {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .title {
      font-size: var(--pal-fs-page-title);
      font-weight: var(--pal-font-extrabold);
    }
    :host(.compact) {
      padding: 0;
    }
    :host(.compact) .title {
      font-size: 17px;
      font-weight: var(--pal-font-bold);
    }
    .dates {
      font-size: var(--pal-fs-secondary);
      color: var(--pal-text-muted);
    }
  `,
  host: { '[class.compact]': 'compact()' },
})
export class MonthSelectorComponent {
  protected readonly months = inject(SelectedMonthService);
  private readonly preferences = inject(PreferencesService);

  /** Smaller title, for pages that already have a page title. */
  readonly compact = input(false);

  protected readonly title = computed(() => monthTitle(this.months.month()));
  protected readonly previousTitle = computed(() => monthTitle(addMonths(this.months.month(), -1)));
  protected readonly nextTitle = computed(() => monthTitle(addMonths(this.months.month(), 1)));
  protected readonly dates = computed(() => {
    if (this.preferences.monthStartDay() === 1) {
      return null;
    }
    const { first, last } = this.months.period();
    return periodLabel(first, last);
  });
}

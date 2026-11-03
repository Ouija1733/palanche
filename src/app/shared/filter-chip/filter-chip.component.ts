import { Component, input } from '@angular/core';

/** Pill-shaped filter button; highlighted when its filter is active. */
@Component({
  selector: 'app-filter-chip',
  template: `<button type="button" [class.active]="active()" [attr.aria-pressed]="active()"><ng-content /></button>`,
  styles: `
    :host {
      flex: none;
    }
    button {
      min-height: 40px;
      padding: 6px 16px;
      border: 1px solid var(--pal-border);
      border-radius: 999px;
      background: var(--pal-surface);
      color: var(--pal-text);
      font: inherit;
      font-size: var(--pal-fs-body);
      font-weight: var(--pal-font-semibold);
      white-space: nowrap;
    }
    button.active {
      border: 2px solid var(--pal-primary);
      background: var(--pal-primary-soft);
      color: var(--pal-primary);
    }
  `,
})
export class FilterChipComponent {
  readonly active = input(false);
}

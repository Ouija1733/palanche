import { Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import type { Category } from '../../core/models/category';

/**
 * Quick category choice: up to 7 categories plus "Altre", in a 4×2 grid.
 * The categories (most used first) come from CategoryService.getMostUsed.
 */
@Component({
  selector: 'app-category-grid',
  imports: [IonIcon],
  template: `
    @for (category of categories(); track category.id) {
      <button
        type="button"
        class="tile"
        [class.selected]="category.id === selectedId()"
        [style.--category-color]="'var(--pal-cat-' + category.color + ')'"
        [attr.aria-pressed]="category.id === selectedId()"
        (click)="selected.emit(category)"
      >
        <ion-icon [name]="category.icon" aria-hidden="true"></ion-icon>
        <span>{{ category.name }}</span>
      </button>
    }
    <button type="button" class="tile more" [class.selected]="moreSelected()" (click)="more.emit()">
      <ion-icon name="ellipsis-horizontal-outline" aria-hidden="true"></ion-icon>
      <span>{{ moreLabel() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .tile {
      min-height: 76px;
      padding: 10px 4px;
      border: 1px solid var(--pal-border);
      border-radius: var(--pal-radius-control);
      background: var(--pal-surface);
      color: var(--pal-text);
      font: inherit;
      font-size: var(--pal-fs-secondary);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .tile ion-icon {
      font-size: 26px;
      color: var(--category-color);
    }
    .tile span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tile.selected {
      border: 2px solid var(--pal-primary);
      background: var(--pal-primary-soft);
      color: var(--pal-primary);
      font-weight: var(--pal-font-semibold);
    }
    .more {
      border-style: dashed;
    }
    .more ion-icon {
      color: var(--pal-text-muted);
    }
  `,
})
export class CategoryGridComponent {
  readonly categories = input.required<readonly Category[]>();
  readonly selectedId = input<string | null>(null);
  /** "Altre", or the name of a selected category that is not in the grid. */
  readonly moreLabel = input('Altre');
  /** True when the selected category is not among the tiles (it was picked from "Altre"). */
  readonly moreSelected = input(false);

  readonly selected = output<Category>();
  readonly more = output<void>();
}

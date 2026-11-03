import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import type { CategoryColor } from '../../core/models/category-palette';

/**
 * Category icon on a soft background of the same color. Without a color it is
 * neutral gray (transfers). The soft background is mixed from the category
 * color, so it follows light and dark mode automatically.
 */
@Component({
  selector: 'app-category-icon',
  imports: [IonIcon],
  template: `<ion-icon [name]="icon()" aria-hidden="true"></ion-icon>`,
  host: {
    '[style.--category-color]': 'colorValue()',
    '[class.small]': "size() === 'small'",
  },
  styles: `
    :host {
      display: grid;
      place-items: center;
      flex: none;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      color: var(--category-color);
      background: color-mix(in srgb, var(--category-color) 12%, var(--pal-surface));
    }
    :host(.small) {
      width: 40px;
      height: 40px;
      border-radius: 12px;
    }
    ion-icon {
      font-size: 24px;
    }
    :host(.small) ion-icon {
      font-size: 20px;
    }
  `,
})
export class CategoryIconComponent {
  readonly icon = input.required<string>();
  readonly color = input<CategoryColor | null>(null);
  readonly size = input<'normal' | 'small'>('normal');

  protected readonly colorValue = computed(() => {
    const color = this.color();
    return color ? `var(--pal-cat-${color})` : 'var(--pal-text-muted)';
  });
}

import { Component, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import type { KeypadKey } from './keypad-input';

/** Numeric keypad for amounts. It only emits keys: the parent keeps the text (see keypad-input.ts). */
@Component({
  selector: 'app-amount-keypad',
  imports: [IonIcon],
  template: `
    @for (key of keys; track key) {
      <button type="button" class="key" (click)="pressed.emit(key)" [attr.aria-label]="label(key)">
        @if (key === 'backspace') {
          <ion-icon name="backspace-outline" aria-hidden="true"></ion-icon>
        } @else {
          {{ key }}
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .key {
      height: 52px;
      border: 0;
      border-radius: var(--pal-radius-control);
      background: var(--pal-track);
      color: var(--pal-text);
      font: inherit;
      font-size: 24px;
      font-weight: var(--pal-font-semibold);
      display: grid;
      place-items: center;
    }
    .key:active {
      background: var(--pal-border);
    }
    ion-icon {
      font-size: 26px;
    }
  `,
})
export class AmountKeypadComponent {
  readonly pressed = output<KeypadKey>();

  protected readonly keys: readonly KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'];

  protected label(key: KeypadKey): string {
    return key === 'backspace' ? 'Cancella' : key === ',' ? 'Virgola' : key;
  }
}

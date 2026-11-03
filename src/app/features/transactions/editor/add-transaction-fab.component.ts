import { Component, inject } from '@angular/core';
import { IonFab, IonFabButton, IonIcon } from '@ionic/angular';

import { TransactionEditorService } from './transaction-editor.service';

/**
 * The "+" button (Home and Movimenti) that opens the new transaction sheet.
 * Place it inside <ion-content> with slot="fixed".
 */
@Component({
  selector: 'app-add-transaction-fab',
  imports: [IonFab, IonFabButton, IonIcon],
  template: `
    <ion-fab vertical="bottom" horizontal="end">
      <ion-fab-button class="pal-fab" aria-label="Nuovo movimento" (click)="editor.open()">
        <ion-icon name="add-outline" aria-hidden="true" />
      </ion-fab-button>
    </ion-fab>
  `,
  styles: `
    :host {
      position: absolute;
      right: 0;
      bottom: 0;
    }
    /* Same 16px margin as the page content (Ionic's default is 10px). */
    ion-fab {
      inset-inline-end: var(--pal-page-padding);
      bottom: var(--pal-page-padding);
    }
  `,
})
export class AddTransactionFabComponent {
  protected readonly editor = inject(TransactionEditorService);
}

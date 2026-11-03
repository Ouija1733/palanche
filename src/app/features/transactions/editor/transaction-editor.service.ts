import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';

import { TransactionEditorComponent } from './transaction-editor.component';

/** Opens the new / edit transaction sheet from anywhere (FAB, list rows). */
@Injectable({ providedIn: 'root' })
export class TransactionEditorService {
  private readonly modals = inject(ModalController);

  async open(transactionId: string | null = null): Promise<void> {
    const modal = await this.modals.create({
      component: TransactionEditorComponent,
      componentProps: { transactionId },
      cssClass: 'pal-sheet',
      // A sheet at full height, with the handle of the mockup; drag down to close.
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: true,
    });
    await modal.present();
  }
}

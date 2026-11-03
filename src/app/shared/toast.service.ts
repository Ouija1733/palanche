import { inject, Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

import { errorMessage } from './error-messages';

/** How long a toast with "Annulla" stays visible. */
const UNDO_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts = inject(ToastController);

  /** Short confirmation, e.g. "Movimento salvato". */
  async info(message: string): Promise<void> {
    await this.show({ message, duration: 2000 });
  }

  async error(error: unknown): Promise<void> {
    await this.show({ message: errorMessage(error), duration: 4000 });
  }

  /** Every deletion shows this: "Movimento eliminato · Annulla". */
  async undo(message: string, onUndo: () => Promise<void>): Promise<void> {
    await this.show({
      message,
      duration: UNDO_DURATION_MS,
      buttons: [{ text: 'Annulla', role: 'cancel', handler: () => void onUndo() }],
    });
  }

  private async show(options: Parameters<ToastController['create']>[0]): Promise<void> {
    // A new toast replaces the previous one instead of stacking.
    await this.toasts.getTop().then((top) => top?.dismiss());
    const toast = await this.toasts.create({ position: 'bottom', cssClass: 'pal-toast', ...options });
    await toast.present();
  }
}

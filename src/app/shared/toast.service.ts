import { inject, Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

import { errorMessage } from './error-messages';

/** How long a toast with "Annulla" stays visible. */
const UNDO_DURATION_MS = 5000;
/** id of the ion-tab-bar in TabsPage. */
const TAB_BAR_ID = 'pal-tab-bar';

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
      // No 'cancel' role: Ionic would paint it with a theme gray, unreadable in dark mode.
      buttons: [{ text: 'Annulla', handler: () => void onUndo() }],
    });
  }

  /**
   * Inside a bottom sheet the toast goes on top, so it never covers the Save
   * buttons. Otherwise it sits just above the visible element marked with
   * `data-toast-anchor` (the summary bar of Movimenti), or above the tab bar.
   */
  private placement(): { position: 'top' | 'bottom'; positionAnchor?: HTMLElement } {
    if (document.querySelector('ion-modal.pal-sheet')) {
      return { position: 'top' };
    }
    // Tab pages stay in the DOM when hidden: pick the anchor that is on screen.
    const anchor = [...document.querySelectorAll<HTMLElement>('[data-toast-anchor]')].find(
      (element) => element.getClientRects().length > 0 && !element.closest('.ion-page-hidden'),
    );
    const positionAnchor = anchor ?? document.getElementById(TAB_BAR_ID) ?? undefined;
    return { position: 'bottom', positionAnchor };
  }

  private async show(options: Parameters<ToastController['create']>[0]): Promise<void> {
    // A new toast replaces the previous one instead of stacking.
    await this.toasts.getTop().then((top) => top?.dismiss());
    const toast = await this.toasts.create({ ...this.placement(), cssClass: 'pal-toast', ...options });
    await toast.present();
  }
}

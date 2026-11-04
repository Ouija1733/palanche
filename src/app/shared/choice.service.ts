import { inject, Injectable } from '@angular/core';
import { ActionSheetController, AlertController } from '@ionic/angular';

export interface ChoiceOption<T extends string = string> {
  value: T;
  label: string;
}

/**
 * Small pickers built on Ionic overlays, shared by filters and settings:
 * one choice in an action sheet, many choices in a dialog with checkboxes.
 * Both resolve to null when the user cancels.
 */
@Injectable({ providedIn: 'root' })
export class ChoiceService {
  private readonly actionSheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);

  async pickOne<T extends string>(
    header: string,
    options: readonly ChoiceOption<T>[],
    selected?: T | null,
  ): Promise<T | null> {
    const sheet = await this.actionSheets.create({
      header,
      cssClass: 'pal-action-sheet',
      buttons: [
        ...options.map((option) => ({
          text: option.label,
          cssClass: option.value === selected ? 'selected' : '',
          data: option.value,
        })),
        { text: 'Annulla', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data, role } = await sheet.onWillDismiss<T>();
    return role === 'cancel' || role === 'backdrop' || data === undefined ? null : data;
  }

  async pickMany<T extends string>(
    header: string,
    options: readonly ChoiceOption<T>[],
    selected: readonly T[],
  ): Promise<T[] | null> {
    const alert = await this.alerts.create({
      header,
      cssClass: 'pal-alert',
      inputs: options.map((option) => ({
        type: 'checkbox' as const,
        label: option.label,
        value: option.value,
        checked: selected.includes(option.value),
      })),
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'OK', role: 'confirm' },
      ],
    });
    await alert.present();
    // Nothing checked means "no filter": every option is included.
    const { data, role } = await alert.onWillDismiss<{ values: T[] }>();
    return role === 'confirm' ? (data?.values ?? []) : null;
  }

  /** "Are you sure?" dialog; resolves to true only on the confirm button. */
  async confirm(options: { header: string; message: string; confirmText: string; danger?: boolean }): Promise<boolean> {
    const alert = await this.alerts.create({
      header: options.header,
      message: options.message,
      cssClass: 'pal-alert',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: options.confirmText, role: 'confirm', cssClass: options.danger ? 'danger' : '' },
      ],
    });
    await alert.present();
    const { role } = await alert.onWillDismiss();
    return role === 'confirm';
  }

  /** A dialog with one text field (e.g. a name); null on cancel. */
  async promptText(options: {
    header: string;
    value?: string;
    placeholder?: string;
    confirmText?: string;
  }): Promise<string | null> {
    const alert = await this.alerts.create({
      header: options.header,
      cssClass: 'pal-alert',
      inputs: [
        {
          name: 'text',
          type: 'text',
          value: options.value ?? '',
          placeholder: options.placeholder,
          attributes: { maxlength: 40 },
        },
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: options.confirmText ?? 'Salva', role: 'confirm' },
      ],
    });
    await alert.present();
    const { data, role } = await alert.onWillDismiss<{ values: { text: string } }>();
    return role === 'confirm' ? (data?.values.text ?? '') : null;
  }
}

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';

/** Settings hub: what is configured once and then rarely touched. */
@Component({
  selector: 'app-settings',
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonIcon, RouterLink],
  template: `
    <ion-header class="ion-no-border pal-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/home" text="" />
        </ion-buttons>
        <ion-title>Impostazioni</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="pal-page">
      <nav class="pal-list">
        @for (entry of entries; track entry.path) {
          <a class="pal-list-row" [routerLink]="entry.path">
            <ion-icon class="icon" [name]="entry.icon" aria-hidden="true" />
            <span class="grow">
              {{ entry.title }}
              <span class="sub">{{ entry.description }}</span>
            </span>
            <ion-icon class="chevron" name="chevron-forward-outline" aria-hidden="true" />
          </a>
        }
      </nav>
    </ion-content>
  `,
  styles: `
    .icon {
      flex: none;
      font-size: 24px;
      color: var(--pal-primary);
    }
  `,
})
export class SettingsPage {
  protected readonly entries = [
    { path: 'accounts', icon: 'wallet-outline', title: 'Conti', description: 'Crea, modifica, riordina, archivia' },
    {
      path: 'categories',
      icon: 'pricetag-outline',
      title: 'Categorie',
      description: 'Rinomina, sposta, unisci, elimina',
    },
    {
      path: 'backup',
      icon: 'shield-checkmark-outline',
      title: 'Backup e dati',
      description: 'Esporta e ripristina i tuoi dati',
    },
  ] as const;
}

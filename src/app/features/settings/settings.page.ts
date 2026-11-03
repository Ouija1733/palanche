import { Component } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/** Settings hub: accounts, categories (T14), backup and data (T15). */
@Component({
  selector: 'app-settings',
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/home" text="" />
        </ion-buttons>
        <ion-title>Impostazioni</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="pal-page">
      <div class="pal-card pal-empty">
        <strong>Conti, categorie, backup</strong>
        Le impostazioni arrivano a breve.
      </div>
    </ion-content>
  `,
})
export class SettingsPage {}

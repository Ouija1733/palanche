import { Component } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/** Backup and data: export and import arrive in T15. */
@Component({
  selector: 'app-backup',
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent],
  template: `
    <ion-header class="ion-no-border pal-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/settings" text="" />
        </ion-buttons>
        <ion-title>Backup e dati</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="pal-page">
      <div class="pal-card pal-empty">
        <strong>Esporta e ripristina</strong>
        Arriva a breve.
      </div>
    </ion-content>
  `,
})
export class BackupPage {}

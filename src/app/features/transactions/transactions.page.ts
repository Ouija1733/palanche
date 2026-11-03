import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

/** Transactions list: built in T13. */
@Component({
  selector: 'app-transactions',
  imports: [IonContent, PageHeaderComponent],
  template: `
    <ion-content class="pal-page">
      <app-page-header title="Movimenti" />
      <div class="pal-card pal-empty">
        <strong>Nessun movimento da mostrare</strong>
        La lista arriva a breve.
      </div>
    </ion-content>
  `,
})
export class TransactionsPage {}

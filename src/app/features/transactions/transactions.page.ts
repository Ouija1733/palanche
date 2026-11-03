import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

import { AddTransactionFabComponent } from './editor/add-transaction-fab.component';

/** Transactions list: built in T13. */
@Component({
  selector: 'app-transactions',
  imports: [IonContent, PageHeaderComponent, AddTransactionFabComponent],
  template: `
    <ion-content class="pal-page">
      <app-page-header title="Movimenti" />
      <div class="pal-card pal-empty">
        <strong>Nessun movimento da mostrare</strong>
        La lista arriva a breve.
      </div>
      <app-add-transaction-fab slot="fixed" />
    </ion-content>
  `,
})
export class TransactionsPage {}

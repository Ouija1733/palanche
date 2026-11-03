import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

/** Budgets arrive in phase 2. */
@Component({
  selector: 'app-budget',
  imports: [IonContent, PageHeaderComponent],
  template: `
    <ion-content class="pal-page">
      <app-page-header title="Budget" />
      <div class="pal-card pal-empty">
        <strong>Arriva nella prossima versione</strong>
        Qui potrai impostare un budget mensile per categoria e vedere quanto ti resta.
      </div>
    </ion-content>
  `,
})
export class BudgetPage {}

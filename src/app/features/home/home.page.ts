import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

/** Home: balance and latest transactions arrive in T12. */
@Component({
  selector: 'app-home',
  imports: [IonContent, PageHeaderComponent],
  template: `
    <ion-content class="pal-page">
      <app-page-header title="Palanche" />
      <div class="pal-card pal-empty">
        <strong>Benvenuto</strong>
        Tocca + per registrare il primo movimento.
      </div>
    </ion-content>
  `,
})
export class HomePage {}

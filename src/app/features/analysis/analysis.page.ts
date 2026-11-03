import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

/** Charts arrive in phase 4. */
@Component({
  selector: 'app-analysis',
  imports: [IonContent, PageHeaderComponent],
  template: `
    <ion-content class="pal-page">
      <app-page-header title="Analisi" />
      <div class="pal-card pal-empty">
        <strong>Arriva nelle prossime versioni</strong>
        Qui vedrai dove vanno i soldi: categorie, andamento nel tempo, entrate e uscite.
      </div>
    </ion-content>
  `,
})
export class AnalysisPage {}

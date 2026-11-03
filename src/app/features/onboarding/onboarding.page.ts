import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

/** First launch: the full flow arrives in T10. */
@Component({
  selector: 'app-onboarding',
  imports: [IonContent],
  template: `
    <ion-content class="pal-page">
      <h1>Benvenuto in Palanche</h1>
    </ion-content>
  `,
})
export class OnboardingPage {}

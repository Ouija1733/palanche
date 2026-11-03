import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

import { registerAppIcons } from './shared/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    registerAppIcons();
  }
}

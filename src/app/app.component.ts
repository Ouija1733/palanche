import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

import { registerAppIcons } from './shared/icons';
import { initSystemBars } from './shared/system-bars';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    registerAppIcons();
    initSystemBars();
  }
}

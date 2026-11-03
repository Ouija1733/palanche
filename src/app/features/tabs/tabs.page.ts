import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';

/** The four tabs, always visible at the bottom. Settings open from the icon in each page header. */
@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        @for (tab of tabs; track tab.path) {
          <ion-tab-button [tab]="tab.path">
            <ion-icon [name]="tab.icon" aria-hidden="true"></ion-icon>
            <ion-label>{{ tab.label }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: `
    ion-tab-bar {
      height: calc(64px + var(--ion-safe-area-bottom, 0px));
      border-top: 1px solid var(--pal-border);
    }
    ion-tab-button {
      --color: var(--pal-text-muted);
      --color-selected: var(--pal-primary);
      font-family: var(--pal-font-family);
    }
    ion-label {
      font-size: var(--pal-fs-secondary);
      font-weight: var(--pal-font-semibold);
    }
    ion-icon {
      font-size: 26px;
    }
  `,
})
export class TabsPage {
  protected readonly tabs = [
    { path: 'home', label: 'Home', icon: 'home-outline' },
    { path: 'transactions', label: 'Movimenti', icon: 'list-outline' },
    { path: 'budget', label: 'Budget', icon: 'disc-outline' },
    { path: 'analysis', label: 'Analisi', icon: 'bar-chart-outline' },
  ] as const;
}

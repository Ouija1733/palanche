import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';

/** Large page title with the settings button on the right (and optional extra content). */
@Component({
  selector: 'app-page-header',
  imports: [IonIcon, RouterLink],
  template: `
    <h1>{{ title() }}</h1>
    <ng-content />
    @if (showSettings()) {
      <a class="settings" routerLink="/settings" aria-label="Impostazioni">
        <ion-icon name="settings-outline" aria-hidden="true"></ion-icon>
      </a>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 0 8px;
    }
    h1 {
      flex: 1;
      margin: 0;
      font-size: var(--pal-fs-page-title);
      font-weight: var(--pal-font-extrabold);
    }
    .settings {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      margin-right: -10px;
      color: var(--pal-text);
    }
    ion-icon {
      font-size: 24px;
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly showSettings = input(true);
}

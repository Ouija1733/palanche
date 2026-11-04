import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { DatabaseService } from './app/core/db/database.service';
import { PreferencesService } from './app/core/services/preferences.service';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    // Open the database, run migrations and load the preferences before the first page is rendered.
    provideAppInitializer(async () => {
      const preferences = inject(PreferencesService);
      await inject(DatabaseService).init();
      await preferences.load();
    }),
  ],
});

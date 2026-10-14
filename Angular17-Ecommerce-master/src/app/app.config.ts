import { APP_INITIALIZER, ApplicationConfig, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from '../Services/auth.interceptor';
import { UserAuthenService } from '../Services/user-auth.service';
import { CategoryStore } from '../Services/category-store.service';

function loadCategoriesOnStartup(): () => Promise<unknown> {
  const categories = inject(CategoryStore);
  return () => firstValueFrom(categories.load());
}

function restoreSessionOnStartup(): () => Promise<boolean> {
  const auth = inject(UserAuthenService);
  return () => firstValueFrom(auth.restoreSession());
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: APP_INITIALIZER, multi: true, useFactory: restoreSessionOnStartup },
    { provide: APP_INITIALIZER, multi: true, useFactory: loadCategoriesOnStartup },
  ]
};

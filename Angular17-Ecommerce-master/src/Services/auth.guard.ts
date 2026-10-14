import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserAuthenService } from './user-auth.service';

/** Sends guests to sign-in and brings them back to the page they asked for. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(UserAuthenService).isUserLogged) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

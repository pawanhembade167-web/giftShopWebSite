import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DataTransferServiceService } from './data-transfer-service.service';
import { UserAuthenService } from './user-auth.service';
import { ADMIN_ROLE } from '../models/user-role';

/** Admin pages open only for signed-in administrators. Guests go to sign-in; customers go home. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(UserAuthenService);
  const router = inject(Router);
  if (!auth.isUserLogged) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  const role = inject(DataTransferServiceService).getLoggedUser()?.role;
  return role === ADMIN_ROLE ? true : router.createUrlTree(['/']);
};

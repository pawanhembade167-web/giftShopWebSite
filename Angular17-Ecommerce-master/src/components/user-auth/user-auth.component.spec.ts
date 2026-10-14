import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { UserAuthComponent } from './user-auth.component';
import { ToastService } from '../../Services/toast.service';
import { UserAuthenService } from '../../Services/user-auth.service';

describe('UserAuthComponent', () => {
  let auth: jasmine.SpyObj<UserAuthenService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<UserAuthenService>('UserAuthenService', ['signIn']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', component: UserAuthComponent }]),
        { provide: UserAuthenService, useValue: auth },
      ],
    });
  });

  it('does not contact the server when the form is incomplete', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/login', UserAuthComponent);

    page.submit();

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(page.form.invalid).toBeTrue();
  });

  it('shows the credentials message when the server rejects the sign in', async () => {
    auth.signIn.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/login', UserAuthComponent);
    page.form.setValue({ email: 'asha@example.com', password: 'wrong' });

    page.submit();
    harness.fixture.detectChanges();

    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toContain('do not match an account');
  });

  it('returns the user to the requested page after signing in', async () => {
    auth.signIn.and.returnValue(of({ id: 7, fullName: 'Asha', email: 'asha@example.com', phone: '+919876543210', role: 'CUSTOMER' }));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/login?returnUrl=%2Fproducts%3Fsort%3Dnewest', UserAuthComponent);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    page.form.setValue({ email: 'asha@example.com', password: 'Secret123' });

    page.submit();

    expect(auth.signIn).toHaveBeenCalledWith('asha@example.com', 'Secret123');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/products?sort=newest');
  });
});

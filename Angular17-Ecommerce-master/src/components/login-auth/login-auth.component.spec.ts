import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { LoginAuthComponent } from './login-auth.component';
import { UserAuthenService } from '../../Services/user-auth.service';

function typeInto(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

describe('LoginAuthComponent', () => {
  let auth: jasmine.SpyObj<UserAuthenService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<UserAuthenService>('UserAuthenService', ['signUp']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'signup', component: LoginAuthComponent }]),
        { provide: UserAuthenService, useValue: auth },
      ],
    });
  });

  it('shows a mismatch message when the passwords differ', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/signup', LoginAuthComponent);
    const root: HTMLElement = harness.routeNativeElement as HTMLElement;
    typeInto(root, '#signup-password', 'Secret123');
    typeInto(root, '#signup-confirm', 'Secret124');
    harness.fixture.detectChanges();

    expect(root.textContent).toContain('Passwords do not match');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('creates the account with the name, email and password when the form is valid', async () => {
    auth.signUp.and.returnValue(of({ id: 7, fullName: 'Asha', email: 'asha@example.com', phone: '+919876543210', role: 'CUSTOMER' }));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/signup', LoginAuthComponent);
    page.form.patchValue({ fullName: ' Asha ', email: 'asha@example.com', phone: '+91 98765 43210', password: 'Secret123', confirmPassword: 'Secret123', acceptTerms: true });

    page.submit();

    expect(auth.signUp).toHaveBeenCalledWith({ fullName: 'Asha', email: 'asha@example.com', phone: '+91 98765 43210', password: 'Secret123' });
  });

  it('does not create an account when the phone number is invalid', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/signup', LoginAuthComponent);
    page.form.patchValue({ fullName: 'Asha', email: 'asha@example.com', phone: 'call me', password: 'Secret123', confirmPassword: 'Secret123', acceptTerms: true });

    page.submit();

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(page.form.controls.phone.invalid).toBeTrue();
  });

  it('requires the terms to be accepted before creating an account', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/signup', LoginAuthComponent);
    page.form.patchValue({ fullName: 'Asha', email: 'asha@example.com', phone: '9876543210', password: 'Secret123', confirmPassword: 'Secret123', acceptTerms: false });

    page.submit();

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(page.form.controls.acceptTerms.invalid).toBeTrue();
  });
});

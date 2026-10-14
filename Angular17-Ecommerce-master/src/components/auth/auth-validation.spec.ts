import { FormControl, FormGroup } from '@angular/forms';
import { passwordStrengthValidator, passwordsMatchValidator, safeReturnUrl } from './auth-validation';

describe('passwordsMatchValidator', () => {
  it('returns a mismatch error when the confirmation differs', () => {
    const group = new FormGroup({
      password: new FormControl('Secret123'),
      confirmPassword: new FormControl('Secret124'),
    }, { validators: passwordsMatchValidator });

    expect(group.errors).toEqual({ mismatch: true });
  });

  it('returns no error when both passwords are equal', () => {
    const group = new FormGroup({
      password: new FormControl('Secret123'),
      confirmPassword: new FormControl('Secret123'),
    }, { validators: passwordsMatchValidator });

    expect(group.errors).toBeNull();
  });
});

describe('passwordStrengthValidator', () => {
  it('rejects passwords shorter than eight characters', () => {
    expect(passwordStrengthValidator(new FormControl('abc12'))).toEqual({ weakPassword: true });
  });

  it('rejects passwords without both a letter and a digit', () => {
    expect(passwordStrengthValidator(new FormControl('onlyletters'))).toEqual({ weakPassword: true });
    expect(passwordStrengthValidator(new FormControl('12345678'))).toEqual({ weakPassword: true });
  });

  it('accepts a password with eight characters, a letter and a digit', () => {
    expect(passwordStrengthValidator(new FormControl('Secret12'))).toBeNull();
  });
});

describe('safeReturnUrl', () => {
  it('keeps an internal path', () => {
    expect(safeReturnUrl('/products?category=1')).toBe('/products?category=1');
  });

  it('falls back to the home page for missing values', () => {
    expect(safeReturnUrl(null)).toBe('/');
  });

  it('rejects absolute and protocol-relative urls', () => {
    expect(safeReturnUrl('https://evil.example')).toBe('/');
    expect(safeReturnUrl('//evil.example')).toBe('/');
  });
});

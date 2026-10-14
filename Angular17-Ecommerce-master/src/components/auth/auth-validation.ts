import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const MIN_PASSWORD_LENGTH = 8;
const LETTER = /[A-Za-z]/;
const DIGIT = /\d/;

export const PHONE_PATTERN = /^\+?[\d\s()-]{10,20}$/;

export const passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  return password === confirmation ? null : { mismatch: true };
};

export const passwordStrengthValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: string = control.value ?? '';
  const isStrong = value.length >= MIN_PASSWORD_LENGTH && LETTER.test(value) && DIGIT.test(value);
  return isStrong ? null : { weakPassword: true };
};

export function passwordRules(value: string): { label: string; met: boolean }[] {
  return [
    { label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: value.length >= MIN_PASSWORD_LENGTH },
    { label: 'Contains a letter', met: LETTER.test(value) },
    { label: 'Contains a number', met: DIGIT.test(value) },
  ];
}

export function safeReturnUrl(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/';
  }
  return raw;
}

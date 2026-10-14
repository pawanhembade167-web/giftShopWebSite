import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserAuthenService } from '../../Services/user-auth.service';
import { AuthLayoutComponent } from '../auth/auth-layout/auth-layout.component';
import { PHONE_PATTERN, passwordRules, passwordStrengthValidator, passwordsMatchValidator } from '../auth/auth-validation';

const MIN_NAME_LENGTH = 2;

@Component({
  selector: 'app-login-auth',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-auth.component.html',
  styleUrls: ['./login-auth.component.scss']
})
export class LoginAuthComponent {
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(UserAuthenService);
  private readonly router = inject(Router);

  readonly minNameLength = MIN_NAME_LENGTH;
  readonly form = this.formBuilder.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(MIN_NAME_LENGTH)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
      acceptTerms: [false, Validators.requiredTrue],
    },
    { validators: passwordsMatchValidator }
  );

  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  get passwordChecklist(): { label: string; met: boolean }[] {
    return passwordRules(this.form.controls.password.value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, email, phone, password } = this.form.getRawValue();
    this.submitting.set(true);

    this.auth.signUp({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/']);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.toast.error(error.status === 0
            ? 'We could not reach the server. Please try again.'
            : 'We could not create your account. Check your details or try a different email address.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }
}

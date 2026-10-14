import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserAuthenService } from '../../Services/user-auth.service';
import { AuthLayoutComponent } from '../auth/auth-layout/auth-layout.component';
import { safeReturnUrl } from '../auth/auth-validation';

@Component({
  selector: 'app-user-auth',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-auth.component.html',
  styleUrl: './user-auth.component.scss'
})
export class UserAuthComponent {
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(UserAuthenService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);

    this.auth.signIn(email.trim(), password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.toast.error(error.status === 401
            ? 'That email and password do not match an account.'
            : 'We could not sign you in right now. Please try again.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }
}

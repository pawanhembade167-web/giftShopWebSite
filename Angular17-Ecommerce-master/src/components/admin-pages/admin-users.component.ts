import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AdminApi, AdminUser } from '../../Services/admin-api.service';
import { ToastService } from '../../Services/toast.service';
import { messageFrom } from '../../Services/error-message';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="admin__title">Customers</h1>
    @if (loading()) {
      <p class="admin__muted">Loading customers…</p>
    } @else {
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Orders</th><th>Access</th></tr></thead>
          <tbody>
            @for (user of users(); track user.id) {
              <tr [class.is-muted]="!user.isActive">
                <td>{{ user.fullName }}</td>
                <td>{{ user.email }}</td>
                <td>{{ user.role | lowercase }}</td>
                <td>{{ user.orderCount }}</td>
                <td>
                  @if (user.role !== 'ADMIN') {
                    <button type="button" class="link-button" [class.link-button--danger]="user.isActive" (click)="toggle(user)">
                      {{ user.isActive ? 'Deactivate' : 'Activate' }}
                    </button>
                  } @else {
                    <span class="admin__muted">Administrator</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminUsersComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly users = signal<AdminUser[]>([]);

  constructor() {
    this.load();
  }

  toggle(user: AdminUser): void {
    this.api.setUserActive(user.id, !user.isActive).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success(`${user.fullName} is now ${user.isActive ? 'deactivated' : 'active'}.`);
        this.load();
      },
      error: (error) => this.toast.error(messageFrom(error, 'We could not update this customer.')),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.users().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.error(messageFrom(error, 'We could not load customers.'));
      },
    });
  }
}

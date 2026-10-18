import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin">
      <aside class="admin__nav" aria-label="Admin navigation">
        <p class="admin__brand">Store admin</p>
        <a routerLink="/admin" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="is-active">Dashboard</a>
        <a routerLink="/admin/products" routerLinkActive="is-active">Products</a>
        <a routerLink="/admin/orders" routerLinkActive="is-active">Orders</a>
        <a routerLink="/admin/hampers" routerLinkActive="is-active">Hamper requests</a>
        <a routerLink="/admin/users" routerLinkActive="is-active">Customers</a>
        <a routerLink="/" class="admin__back">Back to store</a>
      </aside>
      <section class="admin__content">
        <router-outlet />
      </section>
    </div>
  `,
})
export class AdminShellComponent {}

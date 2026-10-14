import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AdminApi, AdminDashboard } from '../../Services/admin-api.service';
import { PRODUCT_CURRENCY } from '../../models/product-display.constants';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="admin__title">Dashboard</h1>
    @if (data(); as d) {
      <div class="admin-tiles">
        <div class="admin-tile"><span>Revenue</span><strong>{{ d.revenue | currency: currency : 'symbol' : '1.0-0' }}</strong></div>
        <div class="admin-tile"><span>Total orders</span><strong>{{ d.totalOrders }}</strong></div>
        <div class="admin-tile"><span>Pending orders</span><strong>{{ d.pendingOrders }}</strong></div>
        <div class="admin-tile"><span>Customers</span><strong>{{ d.totalCustomers }}</strong></div>
        <div class="admin-tile"><span>Products on sale</span><strong>{{ d.totalProducts }}</strong></div>
        <div class="admin-tile admin-tile--warn"><span>Low stock</span><strong>{{ d.lowStockProducts }}</strong></div>
      </div>
    } @else if (failed()) {
      <p class="admin__error" role="alert">We could not load the dashboard. Please try again.</p>
    } @else {
      <p class="admin__muted">Loading…</p>
    }
  `,
})
export class AdminDashboardComponent {
  private readonly api = inject(AdminApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = PRODUCT_CURRENCY;
  readonly data = signal<AdminDashboard | null>(null);
  readonly failed = signal(false);

  constructor() {
    this.api.dashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => this.data.set(value),
      error: () => this.failed.set(true),
    });
  }
}

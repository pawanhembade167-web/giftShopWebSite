import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminApi, AdminOrder } from '../../Services/admin-api.service';
import { ToastService } from '../../Services/toast.service';
import { messageFrom } from '../../Services/error-message';
import { PRODUCT_CURRENCY } from '../../models/product-display.constants';
import { ORDER_STATUS_FILTERS, allowedNextStatuses, canMarkCashPaid } from './order-flow';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin__header">
      <h1 class="admin__title">Orders</h1>
      <label class="admin-filter">Status
        <select class="form-select" [formControl]="statusFilter">
          <option value="">All</option>
          @for (status of statuses; track status) {
            <option [value]="status">{{ status.replace('_', ' ') | lowercase }}</option>
          }
        </select>
      </label>
    </div>

    @if (loading()) {
      <p class="admin__muted">Loading orders…</p>
    } @else if (orders().length === 0) {
      <p class="admin__muted">No orders match this filter.</p>
    } @else {
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Change</th></tr></thead>
          <tbody>
            @for (order of orders(); track order.id) {
              <tr>
                <td>#{{ order.id }}<br /><span class="admin__muted">{{ order.createdAt | date: 'mediumDate' }}</span></td>
                <td>{{ order.customer }}</td>
                <td>{{ order.total | currency: currency : 'symbol' : '1.0-2' }}</td>
                <td>
                  {{ order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Test card' }}<br />
                  <span class="admin__muted">{{ order.paymentStatus | lowercase }}</span>
                  @if (canPay(order)) {
                    <button type="button" class="link-button" (click)="markPaid(order)">Mark paid</button>
                  }
                </td>
                <td>{{ order.status.replace('_', ' ') | lowercase }}</td>
                <td>
                  @if (nextOptions(order).length > 0) {
                    <select class="form-select admin-select" [attr.aria-label]="'Change status of order ' + order.id"
                      (change)="changeStatus(order, $any($event.target).value)">
                      <option value="">Choose…</option>
                      @for (next of nextOptions(order); track next) {
                        <option [value]="next">{{ next.replace('_', ' ') | lowercase }}</option>
                      }
                    </select>
                  } @else {
                    <span class="admin__muted">No further steps</span>
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
export class AdminOrdersComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = PRODUCT_CURRENCY;
  readonly statuses = ORDER_STATUS_FILTERS;
  readonly statusFilter = new FormControl('', { nonNullable: true });
  readonly loading = signal(true);
  readonly orders = signal<AdminOrder[]>([]);

  constructor() {
    this.load();
    this.statusFilter.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  nextOptions(order: AdminOrder): string[] {
    return allowedNextStatuses(order.status);
  }

  canPay(order: AdminOrder): boolean {
    return canMarkCashPaid(order);
  }

  changeStatus(order: AdminOrder, status: string): void {
    if (!status) {
      return;
    }
    this.api.changeOrderStatus(order.id, status).subscribe({
      next: () => {
        this.toast.success(`Order #${order.id} is now ${status.replace('_', ' ').toLowerCase()}.`);
        this.load();
      },
      error: (error) => {
        this.toast.error(messageFrom(error, 'We could not change the order status.'));
        this.load();
      },
    });
  }

  markPaid(order: AdminOrder): void {
    this.api.markPaid(order.id).subscribe({
      next: () => {
        this.toast.success(`Order #${order.id} is marked paid.`);
        this.load();
      },
      error: (error) => this.toast.error(messageFrom(error, 'We could not mark the order paid.')),
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.orders(this.statusFilter.value || null).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.error(messageFrom(error, 'We could not load orders.'));
      },
    });
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommerceApi, OrderSummaryDto } from '../../Services/commerce-api.service';
import { messageFrom } from '../../Services/error-message';
import { PRODUCT_CURRENCY } from '../../models/product-display.constants';
import { orderStatusLabel } from './order-status';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders-page.component.html',
  styleUrl: './orders-page.component.scss'
})
export class OrdersPageComponent {
  private readonly toast = inject(ToastService);
  private readonly commerce = inject(CommerceApi);

  readonly currency = PRODUCT_CURRENCY;
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly orders = signal<OrderSummaryDto[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.commerce.listOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: (error) => {
        this.failed.set(true);
        this.loading.set(false);
        this.toast.error(messageFrom(error, 'We could not load your orders. Please try again.'));
      }
    });
  }

  statusLabel(status: string): string {
    return orderStatusLabel(status);
  }
}

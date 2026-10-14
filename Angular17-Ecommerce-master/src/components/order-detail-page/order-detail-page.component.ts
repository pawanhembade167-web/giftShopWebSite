import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CommerceApi, OrderDetailDto } from '../../Services/commerce-api.service';
import { messageFrom } from '../../Services/error-message';
import { PRODUCT_CURRENCY } from '../../models/product-display.constants';
import { isCancellable, orderStatusLabel, timelineSteps } from '../orders-page/order-status';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail-page.component.html',
  styleUrl: './order-detail-page.component.scss'
})
export class OrderDetailPageComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly commerce = inject(CommerceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = PRODUCT_CURRENCY;
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly failed = signal(false);
  readonly order = signal<OrderDetailDto | null>(null);
  readonly placed = signal(false);
  readonly busy = signal(false);

  readonly steps = computed(() => timelineSteps((this.order()?.timeline ?? []).map((entry) => entry.status)));
  readonly cancellable = computed(() => {
    const current = this.order();
    return current !== null && isCancellable(current.status);
  });

  ngOnInit(): void {
    this.placed.set(this.route.snapshot.queryParamMap.get('placed') === '1');
    if (this.placed()) {
      this.toast.success('Thank you! Your order has been placed.');
    }
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('orderId'));
      this.load(id);
    });
  }

  cancel(): void {
    const current = this.order();
    if (!current) {
      return;
    }
    this.busy.set(true);
    this.commerce.cancelOrder(current.id).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.busy.set(false);
        this.toast.success('Your order has been cancelled and the items are back in stock.');
      },
      error: (error) => {
        this.busy.set(false);
        this.toast.error(messageFrom(error, 'We could not cancel this order. Please try again.'));
      }
    });
  }

  paymentLabel(status: string): string {
    const labels: Record<string, string> = {
      PAID: 'Paid',
      REFUNDED: 'Refunded to your original payment method',
      CANCELLED: 'Cancelled, nothing was charged',
    };
    return labels[status] ?? 'Pending (cash on delivery)';
  }

  statusLabel(status: string): string {
    return orderStatusLabel(status);
  }

  private load(id: number): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.failed.set(false);
    this.commerce.getOrder(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        if (error.status === 404) {
          this.notFound.set(true);
        } else {
          this.failed.set(true);
        }
      }
    });
  }
}

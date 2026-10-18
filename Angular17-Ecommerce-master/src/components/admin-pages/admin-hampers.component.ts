import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AdminApi, AdminHamper } from '../../Services/admin-api.service';
import { ToastService } from '../../Services/toast.service';
import { messageFrom } from '../../Services/error-message';
import { PRODUCT_CURRENCY } from '../../models/product-display.constants';

@Component({
  selector: 'app-admin-hampers',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="admin__title">Hamper requests</h1>
    @if (loading()) {
      <p class="admin__muted">Loading hamper requests…</p>
    } @else if (hampers().length === 0) {
      <p class="admin__muted">No hamper requests yet.</p>
    } @else {
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Hamper</th><th>Recipient</th><th>Occasion</th><th>Delivery</th><th>Items</th><th>Estimated total</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            @for (hamper of hampers(); track hamper.id) {
              <tr>
                <td>
                  <strong>{{ hamper.title }}</strong>
                  @if (hamper.giftWrap) {
                    <span class="admin__muted"> · gift wrap</span>
                  }
                  @if (hamper.message) {
                    <p class="admin__muted">“{{ hamper.message }}”</p>
                  }
                </td>
                <td>{{ hamper.recipientName }}</td>
                <td>{{ hamper.occasion || '—' }}</td>
                <td>{{ hamper.deliveryDate || 'Not chosen' }}</td>
                <td>
                  @for (item of hamper.items; track item.productId) {
                    <div>{{ item.name }} × {{ item.quantity }}</div>
                  }
                </td>
                <td>{{ hamper.estimatedTotal | currency: currency : 'symbol' : '1.0-2' }}</td>
                <td>{{ hamper.status }}</td>
                <td>
                  @if (hamper.status === 'REQUESTED') {
                    <button type="button" class="link-button" (click)="decide(hamper, 'ACCEPTED')">Accept</button>
                    <button type="button" class="link-button link-button--danger" (click)="decide(hamper, 'REJECTED')">Reject</button>
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
export class AdminHampersComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = PRODUCT_CURRENCY;
  readonly loading = signal(true);
  readonly hampers = signal<AdminHamper[]>([]);

  constructor() {
    this.api.hampers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (hampers) => {
        this.hampers.set(hampers);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.error(messageFrom(error, 'We could not load hamper requests.'));
      },
    });
  }

  decide(hamper: AdminHamper, status: 'ACCEPTED' | 'REJECTED'): void {
    this.api.decideHamper(hamper.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.hampers.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        this.toast.success(`Hamper for ${hamper.recipientName} ${status === 'ACCEPTED' ? 'accepted' : 'rejected'}.`);
      },
      error: (error) => this.toast.error(messageFrom(error, 'We could not update this hamper request.')),
    });
  }
}

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi, AdminProduct, ProductInput } from '../../Services/admin-api.service';
import { CategoryStore } from '../../Services/category-store.service';
import { ToastService } from '../../Services/toast.service';
import { messageFrom } from '../../Services/error-message';
import { PRODUCT_CURRENCY } from '../../models/product-display.constants';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin__header">
      <h1 class="admin__title">Products</h1>
      <button type="button" class="btn-primary-cta" (click)="startCreate()">Add product</button>
    </div>

    @if (editing(); as mode) {
      <form class="admin-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <h2 class="admin-form__title">{{ mode === 'new' ? 'New product' : 'Edit product' }}</h2>
        <div class="admin-form__grid">
          <label>Name<input class="form-control" formControlName="name" /></label>
          <label>Brand<input class="form-control" formControlName="brand" /></label>
          <label>Category
            <select class="form-select" formControlName="categoryId">
              <option [ngValue]="null">None</option>
              @for (category of categories(); track category.id) {
                <option [ngValue]="category.id">{{ category.name }}</option>
              }
            </select>
          </label>
          <label>Price (₹)<input class="form-control" type="number" min="1" formControlName="price" /></label>
          <label>Stock<input class="form-control" type="number" min="0" formControlName="stock" /></label>
          <label>Image URL<input class="form-control" formControlName="imageUrl" /></label>
          <label class="admin-form__wide">Description<textarea class="form-control" rows="3" formControlName="description"></textarea></label>
          <label class="admin-form__check"><input type="checkbox" formControlName="isActive" /> Show in the shop</label>
        </div>
        <div class="admin-form__actions">
          <button type="submit" class="btn-primary-cta" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
          <button type="button" class="btn-ghost-cta" (click)="cancel()">Cancel</button>
        </div>
      </form>
    }

    @if (loading()) {
      <p class="admin__muted">Loading products…</p>
    } @else {
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (product of products(); track product.id) {
              <tr [class.is-muted]="!product.isActive">
                <td>{{ product.name }}<br /><span class="admin__muted">{{ product.brand }}</span></td>
                <td>{{ product.price | currency: currency : 'symbol' : '1.0-2' }}</td>
                <td>
                  <input
                    class="form-control admin-stock"
                    type="number"
                    min="0"
                    [value]="product.stock"
                    [attr.aria-label]="'Stock for ' + product.name"
                    (change)="updateStock(product, $any($event.target).value)" />
                </td>
                <td>{{ product.isActive ? 'On sale' : 'Hidden' }}</td>
                <td class="admin-table__actions">
                  <button type="button" class="link-button" (click)="startEdit(product)">Edit</button>
                  @if (product.isActive) {
                    <button type="button" class="link-button link-button--danger" (click)="remove(product)">Remove</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="admin__muted">Showing {{ products().length }} of {{ total() }} products.</p>
    }
  `,
})
export class AdminProductsComponent {
  private readonly api = inject(AdminApi);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly categories = inject(CategoryStore).categories;

  readonly currency = PRODUCT_CURRENCY;
  readonly loading = signal(true);
  readonly products = signal<AdminProduct[]>([]);
  readonly total = signal(0);
  readonly editing = signal<'new' | number | null>(null);
  readonly saving = signal(false);
  private editingId: number | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    brand: [''],
    categoryId: this.fb.control<number | null>(null),
    price: [0, [Validators.required, Validators.min(1)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    imageUrl: [''],
    description: [''],
    isActive: [true],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.products(1, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.products.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.error(messageFrom(error, 'We could not load products.'));
      },
    });
  }

  startCreate(): void {
    this.editingId = null;
    this.form.reset({ name: '', brand: '', categoryId: null, price: 1, stock: 0, imageUrl: '', description: '', isActive: true });
    this.editing.set('new');
  }

  startEdit(product: AdminProduct): void {
    this.editingId = product.id;
    this.form.reset({
      name: product.name,
      brand: product.brand ?? '',
      categoryId: product.categoryId,
      price: product.price,
      stock: product.stock,
      imageUrl: product.imageUrl ?? '',
      description: product.description ?? '',
      isActive: product.isActive,
    });
    this.editing.set(product.id);
  }

  cancel(): void {
    this.editing.set(null);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const input: ProductInput = {
      name: value.name.trim(),
      brand: value.brand.trim() || null,
      categoryId: value.categoryId,
      price: Number(value.price),
      stock: Number(value.stock),
      imageUrl: value.imageUrl.trim() || null,
      description: value.description.trim() || null,
      isActive: value.isActive,
    };
    const request = this.editingId === null
      ? this.api.createProduct(input)
      : this.api.updateProduct(this.editingId, input);
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.success('Product saved.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error(messageFrom(error, 'We could not save the product.'));
      },
    });
  }

  updateStock(product: AdminProduct, raw: string): void {
    const stock = Number(raw);
    if (!Number.isInteger(stock) || stock < 0) {
      this.toast.error('Stock must be a whole number, zero or more.');
      this.load();
      return;
    }
    this.api.setStock(product.id, stock).subscribe({
      next: () => this.toast.success(`Stock for ${product.name} is now ${stock}.`),
      error: (error) => {
        this.toast.error(messageFrom(error, 'We could not update stock.'));
        this.load();
      },
    });
  }

  remove(product: AdminProduct): void {
    this.api.removeProduct(product.id).subscribe({
      next: () => {
        this.toast.success(`${product.name} was removed from the shop.`);
        this.load();
      },
      error: (error) => this.toast.error(messageFrom(error, 'We could not remove the product.')),
    });
  }
}

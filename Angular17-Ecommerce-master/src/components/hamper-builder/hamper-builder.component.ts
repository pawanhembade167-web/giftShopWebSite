import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import IProduct from '../../models/IProduct';
import { PRODUCT_CURRENCY, SEARCH_DEBOUNCE_MS } from '../../models/product-display.constants';
import { CatalogApiService } from '../../Services/catalog-api.service';
import { AddressDto, CommerceApi } from '../../Services/commerce-api.service';
import { HamperApi } from '../../Services/hamper-api.service';
import { ToastService } from '../../Services/toast.service';
import { messageFrom } from '../../Services/error-message';
import { addLine, HamperDraftLine, hamperTotal } from './hamper-lines';
import { HamperModal } from './hamper-modal.service';
import { POSTAL_CODE_PATTERN } from '../checkout-page/checkout-page.component';

export const OCCASIONS = ['Birthday', 'Anniversary', 'Diwali', 'Rakhi', 'Karva Chauth', 'Wedding', 'Valentines Day', 'Other'];
const PRODUCT_PAGE_SIZE = 50;
const MAX_HAMPER_LINES = 30;
const MAX_LINE_QUANTITY = 20;

function trimmedMinLength(minimum: number) {
  return (control: AbstractControl): ValidationErrors | null =>
    typeof control.value === 'string' && control.value.trim().length >= minimum ? null : { trimmedMinLength: true };
}

function validPhone(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value : '';
  return value.length <= 20 && /^\+?\d{10,15}$/.test(value.replace(/[\s()-]/g, '')) ? null : { phone: true };
}

@Component({
  selector: 'app-hamper-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hamper">
      <h2 class="hamper__title">Build a custom hamper</h2>
      <p class="hamper__intro">Choose the items, add a note, and send the request. We confirm the final price and delivery before anything is charged.</p>

      <div class="hamper__layout">
        <form class="auth-form hamper__form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="field__label" for="hamper-title">Hamper name</label>
            <input id="hamper-title" class="form-control" formControlName="title" maxlength="120" placeholder="For Priya's birthday" [attr.aria-invalid]="form.controls.title.touched && form.controls.title.invalid" />
            @if (form.controls.title.touched && form.controls.title.invalid) {
              <p class="field__error" role="alert">Enter a hamper name of at least 2 characters.</p>
            }
          </div>
          <div class="field">
            <label class="field__label" for="hamper-occasion">Occasion</label>
            <select id="hamper-occasion" class="form-select" formControlName="occasion">
              <option value="">Choose an occasion</option>
              @for (option of occasions; track option) {
                <option [value]="option">{{ option }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="hamper-recipient">Recipient's name</label>
            <input id="hamper-recipient" class="form-control" formControlName="recipientName" maxlength="100" [attr.aria-invalid]="form.controls.recipientName.touched && form.controls.recipientName.invalid" />
            @if (form.controls.recipientName.touched && form.controls.recipientName.invalid) {
              <p class="field__error" role="alert">Enter a recipient name of at least 2 characters.</p>
            }
          </div>
          <div class="field">
            <label class="field__label" for="hamper-message">Message on the card (optional)</label>
            <textarea id="hamper-message" class="form-control" rows="3" maxlength="300" formControlName="message"></textarea>
          </div>
          <div class="field">
            <label class="field__label" for="hamper-budget">Budget in ₹ (optional)</label>
            <input id="hamper-budget" class="form-control" type="number" min="0.01" max="1000000" formControlName="budget" />
            @if (form.controls.budget.touched && form.controls.budget.invalid) {
              <p class="field__error" role="alert">Enter a budget greater than zero and no more than ₹1,000,000.</p>
            }
          </div>
          <div class="field">
            <label class="field__label" for="hamper-date">Delivery date (optional)</label>
            <input id="hamper-date" class="form-control" type="date" [min]="today" formControlName="deliveryDate" />
            @if (form.controls.deliveryDate.touched && form.controls.deliveryDate.invalid) {
              <p class="field__error" role="alert">Choose today or a later delivery date.</p>
            }
          </div>
          <div class="field">
            <label class="field__label" for="hamper-address">Deliver to</label>
            @if (addresses().length > 0) {
              <select id="hamper-address" class="form-select" formControlName="addressId">
                <option [ngValue]="null">Choose a saved address</option>
                @for (address of addresses(); track address.id) {
                  <option [ngValue]="address.id">{{ address.fullName }}, {{ address.line1 }}, {{ address.city }} {{ address.postalCode }}</option>
                }
              </select>
            } @else if (loadingAddresses()) {
              <p class="hamper__muted">Loading addresses…</p>
            } @else if (addressLoadFailed()) {
              <p class="field__error" role="alert">We could not load your saved addresses.</p>
              <button type="button" class="link-button" (click)="loadAddresses()">Try again</button>
            } @else {
              <p class="hamper__muted">Add a delivery address for your hamper.</p>
            }
            @if (form.controls.addressId.touched && form.controls.addressId.invalid) {
              <p class="field__error" role="alert">Choose or add a delivery address.</p>
            }
            <button type="button" class="link-button" [disabled]="savingAddress() || loadingAddresses()" (click)="addingAddress.set(!addingAddress())">{{ addingAddress() ? 'Cancel' : 'Add a new address' }}</button>
          </div>
          @if (addingAddress()) {
            <div [formGroup]="addressForm">
              <h3 class="hamper__heading">New delivery address</h3>
              @for (field of addressFields; track field.name) {
                <div class="field">
                  <label class="field__label" [for]="'hamper-address-' + field.name">{{ field.label }}</label>
                  <input class="form-control" [id]="'hamper-address-' + field.name" [formControlName]="field.name" [attr.autocomplete]="field.autocomplete" [attr.aria-invalid]="addressForm.controls[field.name].touched && addressForm.controls[field.name].invalid" />
                  @if (addressForm.controls[field.name].touched && addressForm.controls[field.name].invalid) {
                    <p class="field__error" role="alert">{{ field.error }}</p>
                  }
                </div>
              }
              <button type="button" class="btn-ghost-cta" (click)="saveAddress()" [disabled]="savingAddress()">{{ savingAddress() ? 'Saving…' : 'Save address' }}</button>
            </div>
          }
          <label class="hamper__check"><input type="checkbox" formControlName="giftWrap" /> Add gift wrapping</label>
          <button type="submit" class="btn-primary-cta" [disabled]="submitting()">
            {{ submitting() ? 'Sending…' : 'Send hamper request' }}
          </button>
        </form>

        <div class="hamper__items">
          <div class="field hamper__search">
            <label class="field__label" for="hamper-search">Add items</label>
            <input
              id="hamper-search"
              class="form-control"
              type="search"
              autocomplete="off"
              placeholder="Type a product name"
              [value]="query()"
              (input)="onSearchInput($any($event.target).value)"
              (focus)="openSuggestions()"
              (click)="openSuggestions()"
              (keydown.escape)="onEscape()" />

            @if (suggestOpen() && (results().length > 0 || loadingResults())) {
              <div class="hamper__suggest-panel">
              <ul class="hamper__suggest" role="listbox" aria-label="Products">
                @for (product of results(); track product.id) {
                  <li role="option">
                    <button type="button" class="hamper__suggest-item" (click)="pick(product)">
                      <span>{{ product.Name }}</span>
                      <span class="hamper__muted">{{ product.Price | currency: currency : 'symbol' : '1.0-0' }}</span>
                    </button>
                  </li>
                }
              </ul>
              <p class="hamper__muted hamper__suggest-foot">
                Showing {{ results().length }} of {{ totalMatches() }}
                @if (results().length < totalMatches()) {
                  <button type="button" class="link-button" (click)="loadMore()" [disabled]="loadingResults()">Show more</button>
                }
              </p>
              </div>
            } @else if (suggestOpen() && !loadingResults() && query().trim()) {
              <p class="hamper__muted">No products match "{{ query() }}".</p>
            }
          </div>

          <h3 class="hamper__heading">Your hamper</h3>
          @if (lines().length === 0) {
            <p class="hamper__muted">No items yet. Type above and pick a product.</p>
            @if (submitted()) {
              <p class="field__error" role="alert">Add at least one item to your hamper.</p>
            }
          } @else {
            <ul class="hamper__lines">
              @for (line of lines(); track line.product.id) {
                <li>
                  <span class="hamper__line-name">{{ line.product.Name }}</span>
                  <span class="hamper__qty">
                    <button type="button" (click)="change(line.product.id, -1)" [disabled]="line.quantity <= 1" aria-label="Fewer">−</button>
                    {{ line.quantity }}
                    <button type="button" (click)="change(line.product.id, 1)" [disabled]="line.quantity >= line.product.Quantity || line.quantity >= maxLineQuantity" aria-label="More">+</button>
                  </span>
                  <button type="button" class="link-button link-button--danger" (click)="remove(line.product.id)">Remove</button>
                </li>
              }
            </ul>
            <p class="hamper__total">Estimated total: <strong>{{ total() | currency: currency : 'symbol' : '1.0-2' }}</strong></p>
            <p class="hamper__muted">The final price includes gift wrap and delivery, confirmed before payment.</p>
          }
        </div>
      </div>
    </section>
  `,
})
export class HamperBuilderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly catalog = inject(CatalogApiService);
  private readonly commerce = inject(CommerceApi);
  private readonly hamperApi = inject(HamperApi);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(HamperModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTerms = new Subject<string>();

  readonly occasions = OCCASIONS;
  readonly currency = PRODUCT_CURRENCY;
  readonly maxLineQuantity = MAX_LINE_QUANTITY;
  readonly today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly addingAddress = signal(false);
  readonly savingAddress = signal(false);
  readonly loadingAddresses = signal(false);
  readonly addressLoadFailed = signal(false);
  readonly query = signal('');
  readonly suggestOpen = signal(false);
  readonly results = signal<IProduct[]>([]);
  readonly totalMatches = signal(0);
  readonly loadingResults = signal(false);
  private currentPage = 1;
  readonly lines = signal<HamperDraftLine[]>([]);
  readonly total = computed(() => hamperTotal(this.lines()));

  readonly addresses = signal<AddressDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    title: ['', [trimmedMinLength(2), Validators.maxLength(120)]],
    occasion: [''],
    recipientName: ['', [trimmedMinLength(2), Validators.maxLength(100)]],
    message: ['', Validators.maxLength(300)],
    budget: [null as number | null, [Validators.min(0.01), Validators.max(1000000)]],
    deliveryDate: ['', (control: AbstractControl) => control.value && control.value < this.today ? { pastDate: true } : null],
    giftWrap: [false],
    addressId: [null as number | null, Validators.required],
  });

  readonly addressForm = this.fb.nonNullable.group({
    fullName: ['', [trimmedMinLength(2), Validators.maxLength(100)]],
    phone: ['', validPhone],
    line1: ['', [trimmedMinLength(3), Validators.maxLength(200)]],
    city: ['', [trimmedMinLength(2), Validators.maxLength(100)]],
    state: ['', [trimmedMinLength(2), Validators.maxLength(100)]],
    postalCode: ['', [Validators.required, Validators.pattern(POSTAL_CODE_PATTERN)]],
  });

  readonly addressFields = [
    { name: 'fullName', label: 'Full name', autocomplete: 'name', error: 'Enter a full name of at least 2 characters.' },
    { name: 'phone', label: 'Phone', autocomplete: 'tel', error: 'Enter a valid phone number with 10 to 15 digits.' },
    { name: 'line1', label: 'Street address', autocomplete: 'address-line1', error: 'Enter a street address of at least 3 characters.' },
    { name: 'city', label: 'City', autocomplete: 'address-level2', error: 'Enter a city of at least 2 characters.' },
    { name: 'state', label: 'State', autocomplete: 'address-level1', error: 'Enter a state of at least 2 characters.' },
    { name: 'postalCode', label: 'Postal code', autocomplete: 'postal-code', error: 'Enter a valid postal code.' },
  ] as const;

  constructor() {
    this.loadAddresses();

    this.searchTerms
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        switchMap((term) => this.pageRequest(term, 1)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((page) => {
        this.currentPage = 1;
        this.results.set(page.items);
        this.totalMatches.set(page.total);
        this.loadingResults.set(false);
      });
  }

  loadAddresses(): void {
    this.addressLoadFailed.set(false);
    this.loadingAddresses.set(true);
    this.commerce.listAddresses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (addresses) => {
        this.addresses.set(addresses);
        this.loadingAddresses.set(false);
      },
      error: () => {
        this.addressLoadFailed.set(true);
        this.loadingAddresses.set(false);
      },
    });
  }

  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }
    const value = this.addressForm.getRawValue();
    this.savingAddress.set(true);
    this.commerce.createAddress({
      fullName: value.fullName.trim(), phone: value.phone.trim(), line1: value.line1.trim(), line2: null,
      city: value.city.trim(), state: value.state.trim(), postalCode: value.postalCode.trim(),
      country: 'IN', isDefault: this.addresses().length === 0 && !this.addressLoadFailed(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (address) => {
        this.addresses.update((addresses) => [...addresses, address]);
        this.form.controls.addressId.setValue(address.id);
        this.addingAddress.set(false);
        this.savingAddress.set(false);
        this.addressForm.reset();
      },
      error: (error) => {
        this.savingAddress.set(false);
        this.toast.error(messageFrom(error, 'We could not save that address. Please check the details.'));
      },
    });
  }

  openSuggestions(): void {
    this.suggestOpen.set(true);
    this.searchTerms.next(this.query().trim());
  }

  onSearchInput(term: string): void {
    this.query.set(term);
    this.suggestOpen.set(true);
    this.searchTerms.next(term.trim());
  }

  loadMore(): void {
    if (this.results().length >= this.totalMatches() || this.loadingResults()) {
      return;
    }
    const next = this.currentPage + 1;
    this.pageRequest(this.query().trim(), next).subscribe((page) => {
      this.currentPage = next;
      this.results.update((current) => [...current, ...page.items]);
      this.loadingResults.set(false);
    });
  }

  private pageRequest(term: string, page: number) {
    this.loadingResults.set(true);
    return this.catalog.getProducts({ q: term || null, inStock: true, pageSize: PRODUCT_PAGE_SIZE, page }).pipe(
      catchError(() => {
        this.loadingResults.set(false);
        return of({ items: [] as IProduct[], page, pageSize: PRODUCT_PAGE_SIZE, total: 0, totalPages: 1 });
      })
    );
  }

  pick(product: IProduct): void {
    const existing = this.lines().find((line) => line.product.id === product.id);
    if (!existing && this.lines().length >= MAX_HAMPER_LINES) {
      this.toast.warning('A hamper can contain up to 30 different items.');
      return;
    }
    if (existing && existing.quantity >= MAX_LINE_QUANTITY) {
      this.toast.warning('You can add up to 20 of each item.');
      return;
    }
    this.lines.update((lines) => addLine(lines, product));
    this.query.set('');
    this.results.set([]);
    this.suggestOpen.set(false);
  }

  onEscape(): void {
    this.suggestOpen.set(false);
  }

  change(productId: number, delta: number): void {
    this.lines.update((lines) =>
      lines.map((line) => {
        if (line.product.id !== productId) {
          return line;
        }
        const next = Math.min(Math.max(line.quantity + delta, 1), line.product.Quantity, MAX_LINE_QUANTITY);
        return { ...line, quantity: next };
      })
    );
  }

  remove(productId: number): void {
    this.lines.update((lines) => lines.filter((line) => line.product.id !== productId));
  }

  submit(): void {
    this.submitted.set(true);
    if (this.addingAddress()) {
      this.toast.warning('Save or cancel the new address before sending your request.');
      this.addressForm.markAllAsTouched();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.lines().length === 0) {
      return;
    }
    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.hamperApi.create({
      title: value.title.trim(),
      occasion: value.occasion || null,
      recipientName: value.recipientName.trim(),
      message: value.message.trim() || null,
      budget: value.budget ? Number(value.budget) : null,
      deliveryDate: value.deliveryDate || null,
      giftWrap: value.giftWrap,
      addressId: Number(value.addressId),
      items: this.lines().map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Your hamper request has been sent. We will be in touch to confirm.');
        this.lines.set([]);
        this.form.reset({ giftWrap: false });
        this.modal.hide();
      },
      error: (error) => {
        this.submitting.set(false);
        this.toast.error(messageFrom(error, 'We could not send your hamper request. Please try again.'));
      },
    });
  }
}

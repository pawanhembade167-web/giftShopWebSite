import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import IProduct from '../../models/IProduct';
import { PRODUCT_CURRENCY, SEARCH_DEBOUNCE_MS } from '../../models/product-display.constants';
import { CatalogApiService } from '../../Services/catalog-api.service';
import { HamperApi } from '../../Services/hamper-api.service';
import { ToastService } from '../../Services/toast.service';
import { messageFrom } from '../../Services/error-message';
import { addLine, HamperDraftLine, hamperTotal } from './hamper-lines';
import { HamperModal } from './hamper-modal.service';

export const OCCASIONS = ['Birthday', 'Anniversary', 'Diwali', 'Rakhi', 'Karva Chauth', 'Wedding', 'Valentines Day', 'Other'];
const PRODUCT_PAGE_SIZE = 50;

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
            <input id="hamper-title" class="form-control" formControlName="title" placeholder="For Priya's birthday" />
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
            <input id="hamper-recipient" class="form-control" formControlName="recipientName" />
          </div>
          <div class="field">
            <label class="field__label" for="hamper-message">Message on the card (optional)</label>
            <textarea id="hamper-message" class="form-control" rows="3" maxlength="300" formControlName="message"></textarea>
          </div>
          <div class="field">
            <label class="field__label" for="hamper-budget">Budget in ₹ (optional)</label>
            <input id="hamper-budget" class="form-control" type="number" min="1" formControlName="budget" />
          </div>
          <div class="field">
            <label class="field__label" for="hamper-date">Delivery date (optional)</label>
            <input id="hamper-date" class="form-control" type="date" [min]="today" formControlName="deliveryDate" />
          </div>
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
          } @else {
            <ul class="hamper__lines">
              @for (line of lines(); track line.product.id) {
                <li>
                  <span class="hamper__line-name">{{ line.product.Name }}</span>
                  <span class="hamper__qty">
                    <button type="button" (click)="change(line.product.id, -1)" [disabled]="line.quantity <= 1" aria-label="Fewer">−</button>
                    {{ line.quantity }}
                    <button type="button" (click)="change(line.product.id, 1)" [disabled]="line.quantity >= line.product.Quantity" aria-label="More">+</button>
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
  private readonly hamperApi = inject(HamperApi);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(HamperModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTerms = new Subject<string>();

  readonly occasions = OCCASIONS;
  readonly currency = PRODUCT_CURRENCY;
  readonly today = new Date().toISOString().slice(0, 10);
  readonly submitting = signal(false);
  readonly query = signal('');
  readonly suggestOpen = signal(false);
  readonly results = signal<IProduct[]>([]);
  readonly totalMatches = signal(0);
  readonly loadingResults = signal(false);
  private currentPage = 1;
  readonly lines = signal<HamperDraftLine[]>([]);
  readonly total = computed(() => hamperTotal(this.lines()));

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    occasion: [''],
    recipientName: ['', [Validators.required, Validators.minLength(2)]],
    message: [''],
    budget: [null as number | null],
    deliveryDate: [''],
    giftWrap: [false],
  });

  constructor() {
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
        const next = Math.min(Math.max(line.quantity + delta, 1), line.product.Quantity);
        return { ...line, quantity: next };
      })
    );
  }

  remove(productId: number): void {
    this.lines.update((lines) => lines.filter((line) => line.product.id !== productId));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.lines().length === 0) {
      this.toast.warning('Add at least one item to your hamper.');
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

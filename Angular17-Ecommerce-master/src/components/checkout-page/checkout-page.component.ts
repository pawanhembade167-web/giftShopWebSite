import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AddressDto, CommerceApi, PaymentMethod } from '../../Services/commerce-api.service';
import { CartStore } from '../../Services/cart-store.service';
import { messageFrom } from '../../Services/error-message';
import { PHONE_PATTERN } from '../auth/auth-validation';
import { PRODUCT_CURRENCY } from '../../models/product-display.constants';

export type CheckoutStep = 'address' | 'payment' | 'review';

export const POSTAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{2,10}[A-Za-z0-9]$/;

export const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; detail: string }[] = [
  { value: 'COD', label: 'Cash on delivery', detail: 'Pay in cash when your order arrives.' },
  { value: 'MOCK_CARD', label: 'Test card', detail: 'Development payment: no real money is charged.' },
];

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss'
})
export class CheckoutPageComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly commerce = inject(CommerceApi);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly cart = inject(CartStore);

  readonly currency = PRODUCT_CURRENCY;
  readonly paymentOptions = PAYMENT_OPTIONS;
  readonly steps: { key: CheckoutStep; label: string }[] = [
    { key: 'address', label: 'Address' },
    { key: 'payment', label: 'Payment' },
    { key: 'review', label: 'Review' },
  ];

  readonly step = signal<CheckoutStep>('address');
  readonly addresses = signal<AddressDto[]>([]);
  readonly selectedAddressId = signal<number | null>(null);
  readonly addingAddress = signal(false);
  readonly savingAddress = signal(false);
  readonly paymentMethod = signal<PaymentMethod>('COD');
  readonly placing = signal(false);

  readonly selectedAddress = computed(() => this.addresses().find((address) => address.id === this.selectedAddressId()) ?? null);
  readonly stepIndex = computed(() => this.steps.findIndex((item) => item.key === this.step()));

  readonly addressForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    line1: ['', [Validators.required, Validators.minLength(3)]],
    line2: [''],
    city: ['', [Validators.required, Validators.minLength(2)]],
    state: ['', [Validators.required, Validators.minLength(2)]],
    postalCode: ['', [Validators.required, Validators.pattern(POSTAL_CODE_PATTERN)]],
  });

  ngOnInit(): void {
    this.cart.refresh().subscribe({ error: () => this.toast.error('We could not load your cart. Please try again.') });
    this.commerce.listAddresses().subscribe({
      next: (addresses) => {
        this.addresses.set(addresses);
        const preferred = addresses.find((address) => address.isDefault) ?? addresses[0];
        this.selectedAddressId.set(preferred?.id ?? null);
        this.addingAddress.set(addresses.length === 0);
      },
      error: () => this.toast.error('We could not load your addresses. Please try again.')
    });
  }

  selectAddress(id: number): void {
    this.selectedAddressId.set(id);
  }

  showAddressForm(): void {
    this.addingAddress.set(true);
  }

  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }
    const value = this.addressForm.getRawValue();
    this.savingAddress.set(true);
    this.commerce.createAddress({
      fullName: value.fullName.trim(),
      phone: value.phone.trim(),
      line1: value.line1.trim(),
      line2: value.line2.trim() || null,
      city: value.city.trim(),
      state: value.state.trim(),
      postalCode: value.postalCode.trim(),
      country: 'IN',
      isDefault: this.addresses().length === 0,
    }).subscribe({
      next: (address) => {
        this.addresses.update((list) => [...list, address]);
        this.selectedAddressId.set(address.id);
        this.addingAddress.set(false);
        this.savingAddress.set(false);
        this.addressForm.reset();
      },
      error: (error) => {
        this.savingAddress.set(false);
        this.toast.error(messageFrom(error, 'We could not save that address. Please check the details.'));
      }
    });
  }

  next(): void {
    if (this.step() === 'address') {
      if (!this.selectedAddress()) {
        this.toast.warning('Choose a delivery address to continue.');
        return;
      }
      this.step.set('payment');
    } else if (this.step() === 'payment') {
      this.step.set('review');
    }
  }

  back(): void {
    if (this.step() === 'review') {
      this.step.set('payment');
    } else if (this.step() === 'payment') {
      this.step.set('address');
    }
  }

  placeOrder(): void {
    const address = this.selectedAddress();
    if (!address) {
      this.toast.warning('Choose a delivery address to continue.');
      this.step.set('address');
      return;
    }
    if (this.cart.isEmpty()) {
      this.toast.warning('Your cart is empty.');
      return;
    }
    this.placing.set(true);
    this.commerce.placeOrder(address.id, this.paymentMethod()).subscribe({
      next: (order) => {
        this.placing.set(false);
        this.cart.refresh().subscribe({ error: () => undefined });
        this.router.navigate(['/orders', order.id], { queryParams: { placed: '1' } });
      },
      error: (error) => {
        this.placing.set(false);
        this.toast.error(messageFrom(error, 'We could not place your order. Please try again.'));
      }
    });
  }

  paymentLabel(method: PaymentMethod): string {
    return PAYMENT_OPTIONS.find((option) => option.value === method)?.label ?? method;
  }

  isInvalid(field: string): boolean {
    const control = this.addressForm.get(field);
    return !!control && control.touched && control.invalid;
  }
}

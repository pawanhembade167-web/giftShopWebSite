import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiEnvelope } from './user-api.service';
import { ProductDto, toProduct } from './catalog-api.service';
import IProduct from '../models/IProduct';

export type PaymentMethod = 'COD' | 'MOCK_CARD';

export interface CartLineDto {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  product: ProductDto;
}

export interface CartDto {
  items: CartLineDto[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
}

export interface SkippedLine {
  productId: number;
  reason: 'unavailable' | 'out-of-stock' | 'limited';
}

export interface WishlistDto {
  items: { productId: number; product: ProductDto }[];
  count: number;
}

export interface AddressDto {
  id: number;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface AddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface OrderSummaryDto {
  id: number;
  status: string;
  paymentStatus: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  paymentMethod: string;
  subtotal: number;
  shipping: number;
  tax: number;
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: { productId: number | null; name: string; unitPrice: number; quantity: number; lineTotal: number }[];
  timeline: { status: string; at: string }[];
}

export interface CartLine {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  product: IProduct;
}

export function toCartLine(dto: CartLineDto): CartLine {
  return {
    productId: dto.productId,
    name: dto.name,
    unitPrice: dto.unitPrice,
    quantity: dto.quantity,
    lineTotal: dto.lineTotal,
    stock: dto.stock,
    product: toProduct(dto.product),
  };
}

@Injectable({
  providedIn: 'root'
})
export class CommerceApi {
  private readonly base = `${environment.apiBaseUrl}/api`;

  constructor(private http: HttpClient) {}

  getCart(): Observable<CartDto> {
    return this.http.get<ApiEnvelope<{ cart: CartDto }>>(`${this.base}/cart`).pipe(map((e) => e.data.cart));
  }

  addToCart(productId: number, quantity = 1): Observable<CartDto> {
    return this.http.post<ApiEnvelope<{ cart: CartDto }>>(`${this.base}/cart/items`, { productId, quantity })
      .pipe(map((e) => e.data.cart));
  }

  setCartQuantity(productId: number, quantity: number): Observable<CartDto> {
    return this.http.patch<ApiEnvelope<{ cart: CartDto }>>(`${this.base}/cart/items/${productId}`, { quantity })
      .pipe(map((e) => e.data.cart));
  }

  removeFromCart(productId: number): Observable<CartDto> {
    return this.http.delete<ApiEnvelope<{ cart: CartDto }>>(`${this.base}/cart/items/${productId}`)
      .pipe(map((e) => e.data.cart));
  }

  mergeCart(items: { productId: number; quantity: number }[]): Observable<{ cart: CartDto; skipped: SkippedLine[] }> {
    return this.http.post<ApiEnvelope<{ cart: CartDto; skipped: SkippedLine[] }>>(`${this.base}/cart/merge`, { items })
      .pipe(map((e) => e.data));
  }

  getWishlist(): Observable<WishlistDto> {
    return this.http.get<ApiEnvelope<{ wishlist: WishlistDto }>>(`${this.base}/wishlist`).pipe(map((e) => e.data.wishlist));
  }

  addToWishlist(productId: number): Observable<WishlistDto> {
    return this.http.post<ApiEnvelope<{ wishlist: WishlistDto }>>(`${this.base}/wishlist/items`, { productId })
      .pipe(map((e) => e.data.wishlist));
  }

  removeFromWishlist(productId: number): Observable<WishlistDto> {
    return this.http.delete<ApiEnvelope<{ wishlist: WishlistDto }>>(`${this.base}/wishlist/items/${productId}`)
      .pipe(map((e) => e.data.wishlist));
  }

  moveWishlistItemToCart(productId: number): Observable<{ wishlist: WishlistDto; cart: CartDto }> {
    return this.http.post<ApiEnvelope<{ wishlist: WishlistDto; cart: CartDto }>>(
      `${this.base}/wishlist/items/${productId}/move-to-cart`, {}
    ).pipe(map((e) => e.data));
  }

  listAddresses(): Observable<AddressDto[]> {
    return this.http.get<ApiEnvelope<{ addresses: AddressDto[] }>>(`${this.base}/addresses`).pipe(map((e) => e.data.addresses));
  }

  createAddress(input: AddressInput): Observable<AddressDto> {
    return this.http.post<ApiEnvelope<{ address: AddressDto }>>(`${this.base}/addresses`, input).pipe(map((e) => e.data.address));
  }

  listOrders(): Observable<OrderSummaryDto[]> {
    return this.http.get<ApiEnvelope<{ orders: OrderSummaryDto[] }>>(`${this.base}/orders`).pipe(map((e) => e.data.orders));
  }

  getOrder(orderId: number): Observable<OrderDetailDto> {
    return this.http.get<ApiEnvelope<{ order: OrderDetailDto }>>(`${this.base}/orders/${orderId}`).pipe(map((e) => e.data.order));
  }

  placeOrder(addressId: number, paymentMethod: PaymentMethod): Observable<OrderDetailDto> {
    return this.http.post<ApiEnvelope<{ order: OrderDetailDto }>>(`${this.base}/orders`, { addressId, paymentMethod })
      .pipe(map((e) => e.data.order));
  }

  cancelOrder(orderId: number): Observable<OrderDetailDto> {
    return this.http.post<ApiEnvelope<{ order: OrderDetailDto }>>(`${this.base}/orders/${orderId}/cancel`, {})
      .pipe(map((e) => e.data.order));
  }
}

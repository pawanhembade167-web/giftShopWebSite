import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiEnvelope } from './user-api.service';

export interface AdminDashboard {
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: number;
}

export interface AdminProduct {
  id: number;
  name: string;
  brand: string | null;
  categoryId: number | null;
  price: number;
  rating: number;
  reviewCount: number;
  imageUrl: string | null;
  description: string | null;
  stock: number;
  isActive: boolean;
}

export interface ProductInput {
  name: string;
  brand: string | null;
  categoryId: number | null;
  price: number;
  description: string | null;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
}

export interface AdminOrder {
  id: number;
  userId: number;
  customer: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
}

export interface AdminHamperItem {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface AdminHamper {
  id: number;
  title: string;
  occasion: string | null;
  recipientName: string;
  message: string | null;
  budget: number | null;
  deliveryDate: string | null;
  giftWrap: boolean;
  estimatedTotal: number;
  status: string;
  createdAt: string;
  items: AdminHamperItem[];
}

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  orderCount: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminApi {
  private readonly base = `${environment.apiBaseUrl}/api/admin`;

  constructor(private http: HttpClient) {}

  dashboard(): Observable<AdminDashboard> {
    return this.http.get<ApiEnvelope<AdminDashboard>>(`${this.base}/dashboard`).pipe(map((e) => e.data));
  }

  products(page = 1, pageSize = 20): Observable<{ items: AdminProduct[]; total: number; page: number; pageSize: number }> {
    return this.http
      .get<ApiEnvelope<{ items: AdminProduct[]; total: number; page: number; pageSize: number }>>(
        `${this.base}/products`, { params: { page, pageSize } })
      .pipe(map((e) => e.data));
  }

  createProduct(input: ProductInput): Observable<unknown> {
    return this.http.post(`${this.base}/products`, input);
  }

  updateProduct(id: number, input: ProductInput): Observable<unknown> {
    return this.http.put(`${this.base}/products/${id}`, input);
  }

  setStock(id: number, stock: number): Observable<unknown> {
    return this.http.patch(`${this.base}/products/${id}/stock`, { stock });
  }

  removeProduct(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/products/${id}`);
  }

  orders(status: string | null = null): Observable<AdminOrder[]> {
    const params: Record<string, string> = status ? { status } : {};
    return this.http.get<ApiEnvelope<{ orders: AdminOrder[] }>>(`${this.base}/orders`, { params })
      .pipe(map((e) => e.data.orders));
  }

  changeOrderStatus(id: number, status: string): Observable<unknown> {
    return this.http.patch(`${this.base}/orders/${id}/status`, { status });
  }

  markPaid(id: number): Observable<unknown> {
    return this.http.patch(`${this.base}/orders/${id}/payment`, { paid: true });
  }

  hampers(): Observable<AdminHamper[]> {
    return this.http.get<ApiEnvelope<{ hampers: AdminHamper[] }>>(`${this.base}/hampers`).pipe(map((e) => e.data.hampers));
  }

  decideHamper(id: number, status: 'ACCEPTED' | 'REJECTED'): Observable<AdminHamper> {
    return this.http
      .patch<ApiEnvelope<{ hamper: AdminHamper }>>(`${this.base}/hampers/${id}/status`, { status })
      .pipe(map((e) => e.data.hamper));
  }

  users(): Observable<AdminUser[]> {
    return this.http.get<ApiEnvelope<{ users: AdminUser[] }>>(`${this.base}/users`).pipe(map((e) => e.data.users));
  }

  setUserActive(id: number, isActive: boolean): Observable<unknown> {
    return this.http.patch(`${this.base}/users/${id}/active`, { isActive });
  }
}

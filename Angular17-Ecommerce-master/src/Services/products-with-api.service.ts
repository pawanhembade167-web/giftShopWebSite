import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import IProduct from '../models/IProduct';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductsWithApiService {
  private readonly baseUrl = environment.legacyApiBaseUrl;
  private readonly jsonOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };

  constructor(private httpclient: HttpClient) {}

  getAllPrds(): Observable<IProduct[]> {
    return this.httpclient.get<IProduct[]>(`${this.baseUrl}/products`);
  }

  getPrdByID(prdID: number): Observable<IProduct> {
    return this.httpclient.get<IProduct>(`${this.baseUrl}/products/${prdID}`);
  }

  addNewProduct(product: IProduct): Observable<IProduct> {
    return this.httpclient.post<IProduct>(`${this.baseUrl}/products`, product, this.jsonOptions);
  }

  deleteProduct(prdID: number): Observable<void> {
    return this.httpclient.delete<void>(`${this.baseUrl}/products/${prdID}`, this.jsonOptions);
  }

  updateProduct(prdID: number, updatedProduct: IProduct): Observable<IProduct> {
    return this.httpclient.put<IProduct>(`${this.baseUrl}/products/${prdID}`, updatedProduct, this.jsonOptions);
  }

  fetchCartDetails(user: { email: string }): Observable<IProduct[]> {
    return this.httpclient.get<IProduct[]>(`${this.baseUrl}/cart?email=${encodeURIComponent(user.email)}`);
  }

  addProductToCart(payload: { email: string; product: IProduct | undefined }): Observable<unknown> {
    return this.httpclient.post(`${this.baseUrl}/cart`, payload, this.jsonOptions);
  }

  removeFromCart(payload: { email: string; product_id: number }): Observable<unknown> {
    const email = encodeURIComponent(payload.email);
    return this.httpclient.delete(`${this.baseUrl}/cart?email=${email}&product_id=${payload.product_id}`);
  }

  getPersonalRecommendations(userId: number): Observable<IProduct[]> {
    return this.httpclient.get<IProduct[]>(`${this.baseUrl}/personal_recommendations?user_id=${userId}`);
  }

  viewProduct(payload: { user_id: number | undefined; product_id: number }): Observable<unknown> {
    return this.httpclient.post(`${this.baseUrl}/viewProduct`, payload, this.jsonOptions);
  }

  getRecommendedProducts(payload: { prod: string; nbr: number }): Observable<any> {
    return this.httpclient.post(`${this.baseUrl}/recommendations`, payload, this.jsonOptions);
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ProductCardComponent } from './product-card.component';
import IProduct from '../../../models/IProduct';

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  let component: ProductCardComponent;

  const inStockProduct: IProduct = {
    id: 3,
    Name: 'MSI Katana 15',
    Quantity: 50,
    Price: 999,
    Factory: 'MSI',
    Img: 'katana.jpg',
  };

  function renderProduct(product: IProduct): void {
    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;
    component.product = product;
    component.addToCartEnabled = true;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('shows the brand, name and price in rupees', () => {
    renderProduct(inStockProduct);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('MSI');
    expect(text).toContain('MSI Katana 15');
    expect(text).toContain('₹999');
  });

  it('emits addToCart with the product when the add button is pressed', () => {
    renderProduct(inStockProduct);
    let emitted: IProduct | undefined;
    component.addToCart.subscribe((product) => (emitted = product));

    const button = fixture.nativeElement.querySelector('[data-testid="add-to-cart"]') as HTMLButtonElement;
    button.click();

    expect(emitted).toEqual(inStockProduct);
  });

  it('shows an out-of-stock label and disables add to cart when quantity is zero', () => {
    renderProduct({ ...inStockProduct, Quantity: 0 });

    const button = fixture.nativeElement.querySelector('[data-testid="add-to-cart"]') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect((fixture.nativeElement.textContent as string)).toContain('Out of stock');
  });
});

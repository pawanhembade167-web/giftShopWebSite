import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';

import { AppComponent } from './app.component';

@Component({ standalone: true, template: '<p>page</p>' })
class StubPageComponent {}

describe('AppComponent', () => {
  let fixture: import('@angular/core/testing').ComponentFixture<AppComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: StubPageComponent },
          { path: 'login', component: StubPageComponent },
          { path: 'signup', component: StubPageComponent },
          { path: 'products', component: StubPageComponent },
        ]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  });

  it('shows the header and footer on storefront pages', async () => {
    await router.navigateByUrl('/products');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-header')).not.toBeNull();
    expect(element.querySelector('app-footer')).not.toBeNull();
  });

  it('hides the header and footer on the login page', async () => {
    await router.navigateByUrl('/login');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-header')).toBeNull();
    expect(element.querySelector('app-footer')).toBeNull();
  });

  it('hides the header and footer on the signup page', async () => {
    await router.navigateByUrl('/signup');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-header')).toBeNull();
    expect(element.querySelector('app-footer')).toBeNull();
  });
});

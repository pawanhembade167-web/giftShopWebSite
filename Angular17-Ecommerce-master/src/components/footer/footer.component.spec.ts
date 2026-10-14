import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { FooterComponent } from './footer.component';
import { CONTACT_EMAIL, CONTACT_HOURS, CONTACT_PHONE } from '../../models/product-display.constants';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a contact section with an email link, phone number and support hours', () => {
    const element = fixture.nativeElement as HTMLElement;
    const contact = element.querySelector('[data-testid="footer-contact"]') as HTMLElement;

    expect(contact).not.toBeNull();
    expect(contact.querySelector('a[href^="mailto:"]')?.getAttribute('href')).toBe(`mailto:${CONTACT_EMAIL}`);
    expect(contact.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe(`tel:${CONTACT_PHONE.replace(/\s/g, '')}`);
    expect(contact.textContent).toContain(CONTACT_HOURS);
  });
});

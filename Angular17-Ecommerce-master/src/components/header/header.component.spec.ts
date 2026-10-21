import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { SearchApi, SearchSuggestions } from '../../Services/search-api.service';
import { SEARCH_DEBOUNCE_MS } from '../../models/product-display.constants';

import { HeaderComponent } from './header.component';
import { CategoryStore } from '../../Services/category-store.service';
import { CategoryDto } from '../../Services/catalog-api.service';
import { TOP_NAV_CATEGORY_COUNT } from '../../models/product-display.constants';

const DROPDOWN_HEIGHT_PX = 340;
const DROPDOWN_WIDTH_PX = 280;

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponent;

  const categories: CategoryDto[] = Array.from({ length: TOP_NAV_CATEGORY_COUNT + 2 }, (_, index) => ({
    id: index + 1,
    name: `Category ${index + 1}`,
    slug: `category-${index + 1}`,
    productCount: index === TOP_NAV_CATEGORY_COUNT ? 0 : 100 - index * 10,
    subcategories: [{ name: `Sub ${index + 1}`, productCount: 5, types: [] }],
  }));

  const gelSuggestions: SearchSuggestions = {
    products: [{ id: 9, Name: 'Gel Polish Bubble Bath', Quantity: 3, Price: 500 }],
    categories: [{ id: 7, name: 'Beauty' }],
    subcategories: [{ name: 'Nail Polish', categoryId: 7 }],
  };
  const searchApi = jasmine.createSpyObj<SearchApi>('SearchApi', ['suggestions']);

  beforeEach(async () => {
    searchApi.suggestions.and.returnValue(of(gelSuggestions));
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CategoryStore, useValue: { categories: signal(categories) } },
        { provide: SearchApi, useValue: searchApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows only the largest categories as top-level dropdowns', () => {
    expect(component.topCategories().length).toBe(TOP_NAV_CATEGORY_COUNT);
    expect(component.topCategories()[0].productCount).toBe(100);
    expect(component.allCategories().length).toBe(TOP_NAV_CATEGORY_COUNT + 1);
  });

  it('opens a category dropdown with its subcategories and closes it on a second click', () => {
    const toggle = (fixture.nativeElement as HTMLElement).querySelector('.category-nav__toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    expect(component.openMenu()).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('.dropdown')?.textContent).toContain('Sub 1');

    toggle.click();
    fixture.detectChanges();
    expect(component.openMenu()).toBeNull();
  });

  it('closes an open dropdown when Escape is pressed', () => {
    component.toggleDropdown(1);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(component.openMenu()).toBeNull();
  });

  it('opens a category dropdown when the mouse hovers over it and closes when it leaves', () => {
    component.toggleMenu();
    fixture.detectChanges();
    const item = (fixture.nativeElement as HTMLElement).querySelector('.category-nav__item:has(.category-nav__toggle)') as HTMLElement;

    item.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    expect(component.openMenu()).toBe(1);

    item.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    expect(component.openMenu()).toBeNull();
  });

  it('ignores touch taps as hover so a tap still opens and closes once', () => {
    component.toggleMenu();
    fixture.detectChanges();
    const item = (fixture.nativeElement as HTMLElement).querySelector('.category-nav__item:has(.category-nav__toggle)') as HTMLElement;

    item.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));

    expect(component.openMenu()).toBeNull();
  });

  it('shows matching products, categories and subcategories while typing in search', fakeAsync(() => {
    const input = (fixture.nativeElement as HTMLElement).querySelector('#header-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    component.searchControl.setValue('gel');
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('.suggest') as HTMLElement;
    expect(searchApi.suggestions).toHaveBeenCalledWith('gel');
    expect(panel.textContent).toContain('Gel Polish Bubble Bath');
    expect(panel.textContent).toContain('Beauty');
    expect(panel.textContent).toContain('Nail Polish');
    expect(panel.textContent).toContain('Search for "gel"');
  }));

  it('explains when nothing matches the typed search', fakeAsync(() => {
    searchApi.suggestions.and.returnValue(of({ products: [], categories: [], subcategories: [] }));
    const input = (fixture.nativeElement as HTMLElement).querySelector('#header-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    component.searchControl.setValue('lap');
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.suggest')?.textContent).toContain('No matches for "lap"');
  }));

  it('does not show a category dropdown for a category with no products on sale', () => {
    const names = component.topCategories().map((category) => category.name);

    expect(names.some((name) => name.endsWith('(0)'))).toBeFalse();
    expect(component.topCategories().every((category) => category.productCount > 0)).toBeTrue();
  });

  it('groups the occasions under one Occasions dropdown in the bar, leaving out General', () => {
    const element = fixture.nativeElement as HTMLElement;
    const toggle = Array.from(element.querySelectorAll<HTMLButtonElement>('.category-nav__toggle'))
      .find((button) => button.textContent?.trim().startsWith('Occasions'));

    expect(element.querySelectorAll('.category-nav__occasion').length).toBe(0);
    expect(toggle).toBeDefined();
    expect(component.quickOccasions().length).toBe(TOP_NAV_CATEGORY_COUNT);
    expect(component.quickOccasions().some((occasion) => occasion.name === 'General')).toBeFalse();
  });

  it('lists the occasions inside the Occasions dropdown when it is opened', () => {
    const element = fixture.nativeElement as HTMLElement;
    component.toggleDropdown('occasions');
    fixture.detectChanges();

    const items = element.querySelectorAll('.dropdown a');
    expect(items.length).toBe(component.quickOccasions().length);
    expect(items[0].textContent).toContain('Sub 1');
  });

  it('shows an open dropdown in full, not clipped by the category bar', () => {
    const element = fixture.nativeElement as HTMLElement;
    component.toggleMenu();
    fixture.detectChanges();
    const toggle = element.querySelector('.category-nav__toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    const list = element.querySelector('.category-nav') as HTMLElement;
    const dropdown = element.querySelector('.dropdown') as HTMLElement;
    expect(getComputedStyle(list).overflowX).toBe('visible');
    expect(Math.round(dropdown.getBoundingClientRect().height)).toBe(DROPDOWN_HEIGHT_PX);
    expect(Math.round(dropdown.getBoundingClientRect().width)).toBe(DROPDOWN_WIDTH_PX);
  });

  it('keeps only the search bar fixed to the top while categories scroll away', () => {
    const element = fixture.nativeElement as HTMLElement;
    const bar = element.querySelector('.site-header__bar') as HTMLElement;
    const categories = element.querySelector('.site-header__categories') as HTMLElement;

    expect(getComputedStyle(bar).position).toBe('fixed');
    expect(getComputedStyle(categories).position).not.toBe('fixed');
  });

  it('lists every category with its subcategories in the all-categories panel', () => {
    component.toggleDropdown('all');
    fixture.detectChanges();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('.dropdown--mega') as HTMLElement;
    expect(panel.querySelectorAll('.mega__group').length).toBe(TOP_NAV_CATEGORY_COUNT + 2);
    expect(panel.textContent).toContain('Sub 8');
  });
});

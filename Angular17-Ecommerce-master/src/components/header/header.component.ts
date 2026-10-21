import { ADMIN_ROLE } from '../../models/user-role';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { EMPTY_SUGGESTIONS, SearchApi, SearchSuggestions } from '../../Services/search-api.service';
import { SEARCH_DEBOUNCE_MS } from '../../models/product-display.constants';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CategoryStore } from '../../Services/category-store.service';
import { CategoryDto } from '../../Services/catalog-api.service';
import { UserAuthenService } from '../../Services/user-auth.service';
import { DataTransferServiceService } from '../../Services/data-transfer-service.service';
import { CartStore } from '../../Services/cart-store.service';
import { WishlistStore } from '../../Services/wishlist-store.service';
import { HamperModal } from '../hamper-builder/hamper-modal.service';
import { QUICK_OCCASION_LIMIT, TOP_NAV_CATEGORY_COUNT } from '../../models/product-display.constants';

export const ALL_CATEGORIES_MENU = 'all';
export const OCCASIONS_MENU = 'occasions';
export type OpenMenu = number | typeof ALL_CATEGORIES_MENU | typeof OCCASIONS_MENU | null;

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  private readonly userAuth = inject(UserAuthenService);
  private readonly dataTransfer = inject(DataTransferServiceService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchApi = inject(SearchApi);
  private readonly hamperModal = inject(HamperModal);

  readonly categories = inject(CategoryStore).categories;
  readonly topCategories = computed<CategoryDto[]>(() => this.byProductCount().slice(0, TOP_NAV_CATEGORY_COUNT));
  readonly allCategories = computed<CategoryDto[]>(() => this.byProductCount());
  readonly quickOccasions = computed(() =>
    this.topCategories()
      .flatMap((category) => category.subcategories.map((sub) => ({ categoryId: category.id, name: sub.name })))
      .filter((occasion) => occasion.name !== 'General')
      .slice(0, QUICK_OCCASION_LIMIT)
  );
  readonly cartCount = inject(CartStore).itemCount;
  readonly wishlistCount = inject(WishlistStore).count;
  readonly userLog = toSignal(this.userAuth.getUserLoggedStatus(), { initialValue: this.userAuth.isUserLogged });
  readonly isAdmin = computed(() => this.userLog() && this.dataTransfer.getLoggedUser()?.role === ADMIN_ROLE);
  readonly menuOpen = signal(false);
  readonly openMenu = signal<OpenMenu>(null);
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly suggestOpen = signal(false);
  readonly searching = signal(false);
  readonly suggestions = signal<SearchSuggestions>(EMPTY_SUGGESTIONS);
  readonly hasSuggestions = computed(() => {
    const s = this.suggestions();
    return s.products.length + s.categories.length + s.subcategories.length > 0;
  });

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((value) => {
          const term = value.trim();
          if (!term) {
            this.searching.set(false);
            return of(EMPTY_SUGGESTIONS);
          }
          this.searching.set(true);
          return this.searchApi.suggestions(term).pipe(catchError(() => of(EMPTY_SUGGESTIONS)));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        this.suggestions.set(result);
        this.searching.set(false);
      });
  }

  openSuggestions(): void {
    this.suggestOpen.set(true);
  }

  closeSuggestions(): void {
    this.suggestOpen.set(false);
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (this.host.nativeElement.contains(target as Node)) {
      return;
    }
    this.closeDropdowns();
    this.closeSuggestions();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdowns();
    this.closeSuggestions();
  }

  search(): void {
    const term = this.searchControl.value.trim();
    this.menuOpen.set(false);
    this.closeSuggestions();
    this.router.navigate(['/products'], { queryParams: { q: term || null } });
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleDropdown(key: Exclude<OpenMenu, null>): void {
    this.openMenu.update((current) => (current === key ? null : key));
  }

  openOnHover(event: PointerEvent, key: Exclude<OpenMenu, null>): void {
    if (event.pointerType === 'mouse') {
      this.openMenu.set(key);
    }
  }

  closeOnHover(key: Exclude<OpenMenu, null>): void {
    if (this.openMenu() === key) {
      this.openMenu.set(null);
    }
  }

  closeDropdowns(): void {
    this.openMenu.set(null);
  }

  openHamper(): void {
    this.closeAll();
    this.hamperModal.show();
  }

  closeAll(): void {
    this.closeDropdowns();
    this.closeMenu();
  }

  logout(): void {
    this.userAuth.logout();
    this.closeMenu();
    this.router.navigate(['/']);
  }

  private byProductCount(): CategoryDto[] {
    return [...this.categories()].filter((category) => category.productCount > 0).sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryStore } from '../../Services/category-store.service';
import { CONTACT_EMAIL, CONTACT_HOURS, CONTACT_PHONE, HOME_CATEGORY_COUNT } from '../../models/product-display.constants';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  private readonly categoryStore = inject(CategoryStore);

  readonly topCategories = computed(() =>
    [...this.categoryStore.categories()]
      .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name))
      .slice(0, HOME_CATEGORY_COUNT)
  );
  readonly year = new Date().getFullYear();
  readonly contactEmail = CONTACT_EMAIL;
  readonly contactPhone = CONTACT_PHONE;
  readonly contactPhoneDial = CONTACT_PHONE.replace(/\s/g, '');
  readonly contactHours = CONTACT_HOURS;
}

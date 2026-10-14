import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { HeaderComponent } from '../components/header/header.component';
import { FooterComponent } from '../components/footer/footer.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatbotComponent } from '../components/chatbot/chatbot.component';
import { ToastContainerComponent } from '../components/shared/toast-container/toast-container.component';
import { HamperModalComponent } from '../components/hamper-builder/hamper-modal.component';

const FULL_SCREEN_PATHS = ['/login', '/signup'];

function isFullScreenPath(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return FULL_SCREEN_PATHS.includes(path);
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    // ProductsComponent,
    HeaderComponent,
    FooterComponent,
    // ProductsParentComponent,
    FormsModule,
    CommonModule,
    // RecommendedProductComponent,
    ChatbotComponent,
    ToastContainerComponent,
    HamperModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  private readonly router = inject(Router);

  readonly showShell = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => !isFullScreenPath(event.urlAfterRedirects)),
      startWith(!isFullScreenPath(this.router.url))
    ),
    { requireSync: true }
  );
}

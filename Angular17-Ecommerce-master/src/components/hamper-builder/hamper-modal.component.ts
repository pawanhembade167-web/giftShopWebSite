import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserAuthenService } from '../../Services/user-auth.service';
import { HamperBuilderComponent } from './hamper-builder.component';
import { HamperModal } from './hamper-modal.service';

/** The custom hamper form shown as a dialog over the current page. */
@Component({
  selector: 'app-hamper-modal',
  standalone: true,
  imports: [HamperBuilderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (modal.isOpen()) {
      <div class="hamper-modal__backdrop" (click)="modal.hide()"></div>
      <div class="hamper-modal" role="dialog" aria-modal="true" aria-label="Custom hamper">
        <button type="button" class="hamper-modal__close" aria-label="Close" (click)="modal.hide()">×</button>
        @if (auth.isUserLogged) {
          <app-hamper-builder />
        } @else {
          <section class="hamper">
            <h2 class="hamper__title">Sign in to build a hamper</h2>
            <p class="hamper__intro">Your hamper requests are saved to your account so you can follow them.</p>
            <a class="btn-primary-cta" routerLink="/login" (click)="modal.hide()">Sign in</a>
          </section>
        }
      </div>
    }
  `,
})
export class HamperModalComponent {
  readonly modal = inject(HamperModal);
  readonly auth = inject(UserAuthenService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.modal.hide();
  }
}

import { Injectable, signal } from '@angular/core';

/** Opens and closes the custom hamper dialog from anywhere in the app. */
@Injectable({
  providedIn: 'root'
})
export class HamperModal {
  private readonly open = signal(false);

  readonly isOpen = this.open.asReadonly();

  show(): void {
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
  }
}

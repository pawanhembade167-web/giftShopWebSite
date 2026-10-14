import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastType } from '../../../Services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss'
})
export class ToastContainerComponent {
  readonly toast = inject(ToastService);

  iconFor(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'fa-circle-check';
      case 'error':
        return 'fa-circle-exclamation';
      case 'warning':
        return 'fa-triangle-exclamation';
      case 'info':
        return 'fa-circle-info';
    }
  }
}

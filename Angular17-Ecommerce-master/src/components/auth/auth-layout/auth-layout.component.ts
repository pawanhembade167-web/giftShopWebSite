import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss'
})
export class AuthLayoutComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) subtitle!: string;
}

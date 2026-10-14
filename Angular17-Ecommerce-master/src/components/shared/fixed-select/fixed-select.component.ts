import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';

export interface FixedSelectOption {
  value: string;
  label: string;
}

/** A select whose open list has a fixed height and scrolls, so long option lists keep one size. */
@Component({
  selector: 'app-fixed-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fixed-select.component.html',
  styleUrl: './fixed-select.component.scss'
})
export class FixedSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) id!: string;
  @Input({ required: true }) label!: string;
  @Input() options: FixedSelectOption[] = [];
  @Input() value = '';
  @Input() placeholder = 'All';
  @Output() valueChange = new EventEmitter<string>();

  readonly open = signal(false);

  get selectedLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label ?? this.placeholder;
  }

  toggle(): void {
    this.open.update((current) => !current);
  }

  choose(option: FixedSelectOption): void {
    this.open.set(false);
    this.valueChange.emit(option.value);
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!this.host.nativeElement.contains(target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}

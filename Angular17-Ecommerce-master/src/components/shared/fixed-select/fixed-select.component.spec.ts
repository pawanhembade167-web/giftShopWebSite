import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FixedSelectComponent, FixedSelectOption } from './fixed-select.component';

describe('FixedSelectComponent', () => {
  let fixture: ComponentFixture<FixedSelectComponent>;
  let component: FixedSelectComponent;

  const options: FixedSelectOption[] = Array.from({ length: 30 }, (_, index) => ({
    value: String(index + 1),
    label: `Category ${index + 1}`,
  }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FixedSelectComponent] }).compileComponents();
    fixture = TestBed.createComponent(FixedSelectComponent);
    component = fixture.componentInstance;
    component.id = 'test-select';
    component.label = 'Category';
    component.placeholder = 'All categories';
    component.options = options;
    fixture.detectChanges();
  });

  const button = (): HTMLButtonElement => (fixture.nativeElement as HTMLElement).querySelector('.fixed-select__button') as HTMLButtonElement;

  it('shows the placeholder until a value is chosen', () => {
    expect(button().textContent).toContain('All categories');
  });

  it('opens a list of every option when the box is pressed', () => {
    button().click();
    fixture.detectChanges();

    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('.fixed-select__option');
    expect(items.length).toBe(30);
  });

  it('keeps the list at a fixed height and scrolls the rest', () => {
    button().click();
    fixture.detectChanges();

    const list = (fixture.nativeElement as HTMLElement).querySelector('.fixed-select__list') as HTMLElement;
    expect(Math.round(list.getBoundingClientRect().height)).toBe(280);
    expect(getComputedStyle(list).overflowY).toBe('auto');
  });

  it('emits the chosen value and closes the list', () => {
    let emitted: string | undefined;
    component.valueChange.subscribe((value: string) => (emitted = value));
    button().click();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.fixed-select__option')[2].click();
    fixture.detectChanges();

    expect(emitted).toBe('3');
    expect((fixture.nativeElement as HTMLElement).querySelector('.fixed-select__list')).toBeNull();
  });

  it('closes an open list when Escape is pressed', () => {
    button().click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.fixed-select__list')).toBeNull();
  });
});

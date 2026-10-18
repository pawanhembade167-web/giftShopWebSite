import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminHampersComponent } from './admin-hampers.component';
import { AdminApi, AdminHamper } from '../../Services/admin-api.service';

const hamper: AdminHamper = {
  id: 9,
  title: 'Birthday hamper for Priya',
  occasion: 'Birthday',
  recipientName: 'Priya',
  message: 'Happy birthday!',
  budget: 2000,
  deliveryDate: '2026-11-20',
  giftWrap: true,
  estimatedTotal: 625,
  status: 'REQUESTED',
  createdAt: '2026-10-18T10:00:00',
  items: [{ productId: 1, name: 'Chocolate box', unitPrice: 250, quantity: 2, lineTotal: 500 }],
};

describe('AdminHampersComponent', () => {
  let fixture: ComponentFixture<AdminHampersComponent>;
  let element: HTMLElement;
  let decideHamper: jasmine.Spy;

  function render(hampers: AdminHamper[], decision: 'ACCEPTED' | 'REJECTED' = 'ACCEPTED'): void {
    decideHamper = jasmine.createSpy('decideHamper').and.returnValue(of({ ...hamper, status: decision }));
    TestBed.configureTestingModule({
      imports: [AdminHampersComponent],
      providers: [{ provide: AdminApi, useValue: { hampers: () => of(hampers), decideHamper } }],
    });
    fixture = TestBed.createComponent(AdminHampersComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  }

  function buttonLabelled(label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find((button) => button.textContent?.trim() === label);
  }

  it('lists each hamper request with its recipient, delivery date and estimated total', () => {
    render([hamper]);

    const text = element.textContent ?? '';
    expect(text).toContain('Birthday hamper for Priya');
    expect(text).toContain('Priya');
    expect(text).toContain('2026-11-20');
    expect(text).toContain('REQUESTED');
  });

  it('shows the items inside a hamper request', () => {
    render([hamper]);

    expect(element.textContent).toContain('Chocolate box');
    expect(element.textContent).toContain('× 2');
  });

  it('says there are no requests yet when the list is empty', () => {
    render([]);

    expect(element.textContent).toContain('No hamper requests yet.');
  });

  it('offers accept and reject only for a request that is still waiting', () => {
    render([hamper]);

    expect(buttonLabelled('Accept')).toBeDefined();
    expect(buttonLabelled('Reject')).toBeDefined();
  });

  it('hides accept and reject once a request has been decided', () => {
    render([{ ...hamper, status: 'ACCEPTED' }]);

    expect(buttonLabelled('Accept')).toBeUndefined();
    expect(buttonLabelled('Reject')).toBeUndefined();
  });

  it('accepts a request and shows its new status', () => {
    render([hamper]);

    buttonLabelled('Accept')?.click();
    fixture.detectChanges();

    expect(decideHamper).toHaveBeenCalledWith(9, 'ACCEPTED');
    expect(element.textContent).toContain('ACCEPTED');
    expect(buttonLabelled('Accept')).toBeUndefined();
  });

  it('rejects a request and shows its new status', () => {
    render([hamper], 'REJECTED');

    buttonLabelled('Reject')?.click();
    fixture.detectChanges();

    expect(decideHamper).toHaveBeenCalledWith(9, 'REJECTED');
    expect(element.textContent).toContain('REJECTED');
  });
});

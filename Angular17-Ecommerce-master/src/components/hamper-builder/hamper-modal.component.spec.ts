import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { HamperModalComponent } from './hamper-modal.component';
import { HamperModal } from './hamper-modal.service';
import { UserAuthenService } from '../../Services/user-auth.service';

describe('HamperModalComponent', () => {
  let fixture: ComponentFixture<HamperModalComponent>;
  let modal: HamperModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HamperModalComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UserAuthenService, useValue: { isUserLogged: false, getUserLoggedStatus: () => ({ subscribe: () => ({}) }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HamperModalComponent);
    modal = TestBed.inject(HamperModal);
    fixture.detectChanges();
  });

  it('shows a visible dialog when the hamper modal is opened', () => {
    modal.show();
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(getComputedStyle(dialog).display).not.toBe('none');
    expect(dialog.getBoundingClientRect().height).toBeGreaterThan(0);
  });
});

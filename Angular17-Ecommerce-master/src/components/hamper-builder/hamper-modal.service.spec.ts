import { TestBed } from '@angular/core/testing';

import { HamperModal } from './hamper-modal.service';

describe('HamperModal', () => {
  let modal: HamperModal;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    modal = TestBed.inject(HamperModal);
  });

  it('starts closed, opens when asked, and closes again', () => {
    expect(modal.isOpen()).toBeFalse();

    modal.show();
    expect(modal.isOpen()).toBeTrue();

    modal.hide();
    expect(modal.isOpen()).toBeFalse();
  });
});

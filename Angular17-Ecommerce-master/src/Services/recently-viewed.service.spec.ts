import { TestBed } from '@angular/core/testing';

import { RecentlyViewedService, RECENTLY_VIEWED_LIMIT } from './recently-viewed.service';

describe('RecentlyViewedService', () => {
  let service: RecentlyViewedService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecentlyViewedService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('record', () => {
    it('puts the most recently viewed product first without duplicates', () => {
      service.record(1);
      service.record(2);
      service.record(1);

      expect(service.getIds()).toEqual([1, 2]);
    });

    it('keeps only the most recent products up to the limit', () => {
      for (let id = 1; id <= RECENTLY_VIEWED_LIMIT + 3; id++) {
        service.record(id);
      }

      expect(service.getIds().length).toBe(RECENTLY_VIEWED_LIMIT);
      expect(service.getIds()[0]).toBe(RECENTLY_VIEWED_LIMIT + 3);
    });
  });

  describe('getIds', () => {
    it('returns an empty list when stored data is corrupted', () => {
      localStorage.setItem('echomart.recentlyViewed', '{not json');

      expect(service.getIds()).toEqual([]);
    });
  });
});

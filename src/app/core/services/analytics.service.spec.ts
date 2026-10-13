import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';

import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: new Subject() } },
        { provide: AuthService, useValue: { currentUser$: new BehaviorSubject(null) } },
        { provide: TokenStorageService, useValue: { decodeAccessToken: () => null } },
      ],
    });
    service = TestBed.inject(AnalyticsService);
  });

  it('stays off and loads no script when no analytics ID is configured', () => {
    const before = document.scripts.length;
    service.init();
    expect(service.enabled).toBeFalse();
    expect(document.scripts.length).toBe(before);
  });

  it('strips query strings and ids from tracked paths', () => {
    const sanitize = (service as unknown as { sanitizePath(u: string): string }).sanitizePath;
    expect(sanitize('/reset-password?token=secret')).toBe('/reset-password');
    expect(sanitize('https://x.test/api/v1/customers/3f2504e0-4f89-11d3-9a0c-0305e82c3301/tags')).toBe('/api/v1/customers/:id/tags');
    expect(sanitize('/leads/42')).toBe('/leads/:id');
  });
});

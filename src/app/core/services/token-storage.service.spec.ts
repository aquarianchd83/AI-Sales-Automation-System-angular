import { TestBed } from '@angular/core/testing';

import { TokenStorageService } from './token-storage.service';

/** Builds an unsigned JWT with the given payload — enough for claim-decoding tests. */
function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
}

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
  });

  afterEach(() => localStorage.clear());

  it('round-trips the token pair', () => {
    service.store('access-abc', 'refresh-xyz');

    expect(service.accessToken).toBe('access-abc');
    expect(service.refreshToken).toBe('refresh-xyz');
  });

  it('clears both tokens', () => {
    service.store('access-abc', 'refresh-xyz');
    service.clear();

    expect(service.accessToken).toBeNull();
    expect(service.refreshToken).toBeNull();
  });

  it('decodes claims from the access token', () => {
    service.store(fakeJwt({ email: 'ada@example.com', role: 'Admin' }), 'refresh');

    expect(service.decodeAccessToken()?.['email']).toBe('ada@example.com');
  });

  it('returns null rather than throwing on a malformed token', () => {
    service.store('not-a-jwt', 'refresh');

    expect(service.decodeAccessToken()).toBeNull();
  });

  it('treats a past exp as expired', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    service.store(fakeJwt({ exp: past }), 'refresh');

    expect(service.isAccessTokenExpired()).toBeTrue();
  });

  it('treats a future exp as valid, and respects the leeway', () => {
    const in30Seconds = Math.floor(Date.now() / 1000) + 30;
    service.store(fakeJwt({ exp: in30Seconds }), 'refresh');

    expect(service.isAccessTokenExpired()).toBeFalse();
    // With 60s of leeway a token expiring in 30s counts as already expired.
    expect(service.isAccessTokenExpired(60)).toBeTrue();
  });

  it('reports expired when there is no token at all', () => {
    expect(service.isAccessTokenExpired()).toBeTrue();
  });
});

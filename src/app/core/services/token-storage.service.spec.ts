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

  describe('storeImpersonation (per-tab isolation)', () => {
    it('is readable via accessToken and has no refresh token', () => {
      service.storeImpersonation('impersonation-token');

      expect(service.accessToken).toBe('impersonation-token');
      expect(service.refreshToken).toBeNull();
    });

    it('never writes to localStorage, so it cannot leak into another tab sharing it', () => {
      service.storeImpersonation('impersonation-token');

      expect(localStorage.getItem('wsa.accessToken')).toBeNull();
      expect(localStorage.getItem('wsa.refreshToken')).toBeNull();
    });

    it('does not overwrite an existing localStorage session (the operator tab this was opened from)', () => {
      service.store('operator-access', 'operator-refresh');

      service.storeImpersonation('impersonation-token');

      expect(localStorage.getItem('wsa.accessToken')).toBe('operator-access');
      expect(localStorage.getItem('wsa.refreshToken')).toBe('operator-refresh');
      // This service instance now reports the impersonation token (this tab's own state) —
      // a separate TokenStorageService instance in the operator's own tab would still see its
      // own localStorage-backed tokens untouched, as asserted above.
      expect(service.accessToken).toBe('impersonation-token');
    });

    it('clear() drops only the in-memory impersonation token, leaving localStorage untouched', () => {
      // Simulates the operator's own tab's already-persisted session sitting in the same
      // localStorage this test's service instance also reads from — set directly rather than
      // via store() on this instance, since a real tab is only ever one or the other, never both.
      localStorage.setItem('wsa.accessToken', 'operator-access');
      localStorage.setItem('wsa.refreshToken', 'operator-refresh');

      service.storeImpersonation('impersonation-token');
      expect(service.accessToken).toBe('impersonation-token');

      service.clear();

      expect(localStorage.getItem('wsa.accessToken')).toBe('operator-access');
      expect(localStorage.getItem('wsa.refreshToken')).toBe('operator-refresh');
    });
  });
});

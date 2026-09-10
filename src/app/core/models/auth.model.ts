import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
  /**
   * Optional workspace slug — a UX nicety only (a clearer "wrong workspace" error), never what
   * actually resolves or isolates a tenant; the account's own TenantId and the JWT's tenant claim
   * do that regardless of whether this is sent. Left undefined until the frontend resolves a
   * subdomain to a slug (wildcard DNS is not wired up yet — see the backend's own SaaS conversion
   * plan notes), so it is always omitted today.
   */
  slug?: string;
}

/** TenantSignUpRequest — the only self-serve account-creation path: creates a new Tenant (on a
 * 14-day trial) and its first Admin user in one call, then logs that user in. */
export interface SignUpRequest {
  companyName: string;
  /** Optional — derived from companyName and de-duplicated automatically when omitted. */
  slug?: string | null;
  fullName: string;
  email: string;
  password: string;
}

/** TokenPairDto — response of POST /auth/login and /auth/refresh-token. */
export interface AuthResult {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * The subset of JWT claims the panel reads locally, keyed the way JwtTokenService (Infrastructure)
 * actually issues them — `System.Security.Claims.ClaimTypes` constants serialize to their full XML/
 * Microsoft schema URIs, not the short names (`sub`, `role`) a hand-decoded JWT might lead you to
 * expect. Verified by decoding a real access token from a running instance.
 */
export const JWT_CLAIM_TYPES = {
  nameIdentifier: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  /** Present only on an impersonation access token (SaaS conversion Platform Admin Console) — the
   * acting PlatformSuperAdmin's user id. */
  impersonatedBy: 'impersonated_by',
  tenantId: 'tenant_id',
} as const;

export interface AccessTokenClaims {
  exp?: number;
  [claim: string]: unknown;
}

/** Reads the handful of claims this app cares about off a decoded token, under their real key
 * names (see JWT_CLAIM_TYPES). Centralized here so AuthService's claim-derived fallback user and
 * the impersonation bootstrap flow can't drift onto two different (and differently wrong) sets of
 * key guesses. */
export function readAccessTokenClaims(claims: AccessTokenClaims): {
  id: string;
  email: string;
  name: string;
  roles: string[];
  impersonatedByUserId: string | null;
} {
  const role = claims[JWT_CLAIM_TYPES.role];
  const email = (claims[JWT_CLAIM_TYPES.email] as string | undefined) ?? '';
  return {
    id: (claims[JWT_CLAIM_TYPES.nameIdentifier] as string | undefined) ?? '',
    email,
    name: (claims[JWT_CLAIM_TYPES.name] as string | undefined) ?? email,
    roles: Array.isArray(role) ? role : role ? [role as string] : [],
    impersonatedByUserId: (claims[JWT_CLAIM_TYPES.impersonatedBy] as string | undefined) ?? null,
  };
}

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

/** The subset of JWT claims the panel reads locally. */
export interface AccessTokenClaims {
  sub?: string;
  email?: string;
  name?: string;
  role?: string | string[];
  exp?: number;
  [claim: string]: unknown;
}

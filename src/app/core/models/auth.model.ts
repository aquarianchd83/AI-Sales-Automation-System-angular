import { User } from './user.model';

export interface LoginRequest {
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

/**
 * UserProfileDto (GET /account/profile) — the signed-in user's own account, whatever their role. `timezone`
 * is always the effective value (the platform default until the user picks one), never blank; `countryCode`
 * has no default and is null until set. Roles, createdAt and lastLoginAt are read-only facts — a user can't
 * grant themselves a role here.
 */
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  timezone: string;
  countryCode: string | null;
  roles: string[];
  isPlatformSuperAdmin: boolean;
  tenantId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

/**
 * Body of PUT /account/profile — replaces every editable field, so a null optional field clears it.
 *
 * `email` is the sign-in identity: changing it changes what the user logs in with. The access token in hand
 * keeps the old email in its claims until the next sign-in, so claim-derived values (notably the actor email
 * on platform audit entries) show the previous address until then. Say so before saving a changed email.
 */
export interface UpdateUserProfileRequest {
  fullName: string;
  email: string;
  phoneNumber: string | null;
  timezone: string;
  countryCode: string | null;
}

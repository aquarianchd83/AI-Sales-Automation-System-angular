/** TenantProfileDto — the calling tenant's own editable profile fields, just Timezone for now.
 * Always the effective value (defaults to "Asia/Kolkata" when never set), never blank. */
export interface TenantProfile {
  timezone: string;
}

/** Body of PUT the tenant's own timezone (or a PlatformSuperAdmin's override of it) — must be one
 * of the ids GET /timezones returns. */
export interface UpdateTenantTimezoneRequest {
  timezone: string;
}

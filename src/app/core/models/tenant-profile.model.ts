/** TenantProfileDto — the calling tenant's own editable profile fields. Timezone is always the
 * effective value (defaults to "Asia/Kolkata" when never set), never blank. countryCode has no such
 * default — null means "never set", and plan pricing quotes in USD until it is (see
 * RegionalPricingCatalog.Resolve on the backend). */
export interface TenantProfile {
  timezone: string;
  countryCode: string | null;
}

/** Body of PUT the tenant's own timezone (or a PlatformSuperAdmin's override of it) — must be one
 * of the ids GET /timezones returns. */
export interface UpdateTenantTimezoneRequest {
  timezone: string;
}

/** Body of PUT the tenant's own country (or a PlatformSuperAdmin's override of it) — must be one of
 * the codes GET /billing/regions returns; this is what actually fixes a tenant's plan pricing
 * currency when it's showing USD because countryCode was never set. */
export interface UpdateTenantCountryRequest {
  countryCode: string;
}

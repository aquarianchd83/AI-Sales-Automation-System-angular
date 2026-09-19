/** TenantProfileDto — the calling tenant's own editable profile: business details plus timezone and
 * country. companyName is the tenant's name from signup. Timezone is always the effective value
 * (defaults to "Asia/Kolkata" when never set), never blank. countryCode has no such default — null
 * means "never set", and plan pricing quotes in USD until it is (see RegionalPricingCatalog.Resolve on
 * the backend). domainKeywords is never null. The business fields are stored for the tenant's own
 * reference; nothing else in the platform reads them yet. */
export interface TenantProfile {
  companyName: string;
  productName: string | null;
  industry: string | null;
  businessDescription: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  domainKeywords: string[];
  timezone: string;
  countryCode: string | null;
  /** The tenant's state where its country's tax splits by state (India) — decides CGST + SGST versus IGST. */
  stateCode?: string | null;
}

/** Body of PUT /tenant-profile — replaces every business field at once, so a null optional field
 * clears it. Timezone and country keep their own endpoints. */
export interface UpdateTenantBusinessProfileRequest {
  companyName: string;
  productName: string | null;
  industry: string | null;
  businessDescription: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  domainKeywords: string[];
}

/** Mirrors TenantProfileLimits on the backend (UpdateTenantBusinessProfileRequestValidator). */
export const TENANT_PROFILE_LIMITS = {
  companyName: 200,
  productName: 200,
  industry: 100,
  businessDescription: 2000,
  websiteUrl: 300,
  supportEmail: 256,
  supportPhone: 32,
  keyword: 50,
  maxKeywords: 30,
} as const;

/** Loose client-side hint only; the API re-validates with Uri.TryCreate. */
export const WEBSITE_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

/** Same rule as TenantBusinessDetailsValidator.SupportPhone on the backend. */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{5,31}$/;

export const INDUSTRY_SUGGESTIONS = [
  'Automotive',
  'Education',
  'Financial services',
  'Food & beverage',
  'Healthcare',
  'Real estate',
  'Retail & e-commerce',
  'Solar & energy',
  'Technology & software',
  'Travel & hospitality',
];

export function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Adds one keyword or a pasted comma-separated list to `existing`, the same way the backend
 * normalizes them: trimmed, inner whitespace collapsed, blanks and case-insensitive duplicates
 * skipped. Anything too long or past the limit is reported in `error` instead of added.
 */
export function addDomainKeywords(existing: string[], raw: string): { keywords: string[]; error: string | null } {
  const L = TENANT_PROFILE_LIMITS;
  let keywords = existing;
  let error: string | null = null;
  for (const part of raw.split(',')) {
    const keyword = part.trim().replace(/\s+/g, ' ');
    if (!keyword) {
      continue;
    }
    if (keyword.length > L.keyword) {
      error = `Keywords can be at most ${L.keyword} characters.`;
      continue;
    }
    if (keywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
      continue;
    }
    if (keywords.length >= L.maxKeywords) {
      error = `You can add up to ${L.maxKeywords} keywords.`;
      break;
    }
    keywords = [...keywords, keyword];
  }
  return { keywords, error };
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
  /** India only; ignored (and cleared) for any other country. */
  stateCode?: string | null;
}

/** TenantProfileDto — the calling tenant's own editable profile: business details plus timezone and
 * country. companyName is the tenant's name from signup. Timezone is always the effective value
 * (defaults to "Asia/Kolkata" when never set), never blank. countryCode has no such default — null
 * means "never set", and plan pricing quotes in USD until it is (see RegionalPricingCatalog.Resolve on
 * the backend). domainKeywords is never null. This is the single copy of the business facts: the guided
 * application setup reads and writes the same fields (name, description, website, industry, contact,
 * working hours and the audience), so an answer given there shows up here and the other way round. */
export interface TenantProfile {
  companyName: string;
  productName: string | null;
  industry: string | null;
  /** The speciality within the industry - "Eye clinic" under Healthcare - which the industry alone is too general to say. */
  industrySubcategory?: string | null;
  businessDescription: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  domainKeywords: string[];
  timezone: string;
  countryCode: string | null;
  /** The tenant's state where its country's tax splits by state (India) — decides CGST + SGST versus IGST. */
  stateCode?: string | null;
  workingHours?: string | null;
  /** Who the business wants to reach. */
  targetAudience?: string | null;
  /** Cities or regions customers are sought in (not where the business itself is based). */
  targetLocation?: string | null;
  /** One of TARGET_CUSTOMER_TYPES' values. */
  targetCustomerType?: string | null;
}

/** Body of PUT /tenant-profile — replaces every business field at once, so a null optional field
 * clears it. Timezone and country keep their own endpoints. */
export interface UpdateTenantBusinessProfileRequest {
  companyName: string;
  productName: string | null;
  industry: string | null;
  industrySubcategory: string | null;
  businessDescription: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  domainKeywords: string[];
  workingHours: string | null;
  targetAudience: string | null;
  targetLocation: string | null;
  targetCustomerType: string | null;
}

/** Mirrors TenantProfileLimits on the backend (UpdateTenantBusinessProfileRequestValidator). */
export const TENANT_PROFILE_LIMITS = {
  companyName: 200,
  productName: 200,
  industry: 100,
  industrySubcategory: 100,
  businessDescription: 2000,
  websiteUrl: 300,
  supportEmail: 256,
  supportPhone: 32,
  workingHours: 500,
  targetAudience: 1000,
  targetLocation: 500,
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

/** The values match the "Target customer type" question of the setup plans, which stores the same field. */
export const TARGET_CUSTOMER_TYPES = [
  { value: 'smb', label: 'Small & medium businesses' },
  { value: 'enterprise', label: 'Large enterprises' },
  { value: 'startups', label: 'Startups' },
  { value: 'consumers', label: 'Individual consumers' },
];

/** KeywordSuggestionsDto - `source` is "AI" when the tenant's AI provider wrote them, "Common terms" when they came from
 * the built-in list for well-known industries; the screen says which. */
export interface KeywordSuggestions {
  keywords: string[];
  source: 'AI' | 'Common terms';
}

/** Body of POST /tenant-profile/keyword-suggestions. `existing` are never suggested again. */
export interface SuggestKeywordsRequest {
  industry: string;
  industrySubcategory?: string | null;
  businessDescription: string | null;
  existing: string[];
}

/** RefinedDescriptionDto - `source` is "AI" when the tenant's AI provider rewrote the description and "Tidied" when it
 * could only be cleaned up (spacing and punctuation); the screen says which. */
export interface RefinedDescription {
  description: string;
  source: 'AI' | 'Tidied';
}

/** Body of POST /tenant-profile/description-refinement. */
export interface RefineDescriptionRequest {
  description: string;
  industry: string | null;
  industrySubcategory: string | null;
}

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

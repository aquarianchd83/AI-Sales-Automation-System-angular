/** LeadDiscoveryProfileDto (verified against /swagger/v1/swagger.json) — what the tenant's
 * lead-discovery job looks for. GET returns a disabled profile with default values when none has been
 * saved yet, so updatedAt null means "never saved". planMaxBatchSize is the tenant's plan cap on new
 * leads per run; null when no plan applies. sourceCampaignName/sourceCampaignStatus are the selected
 * auto-campaign source's current name/status, resolved server-side — both null when sourceCampaignId is
 * unset or no longer resolves to an existing campaign (the cue to show a "campaign no longer exists"
 * warning instead of a blank picker). */
export interface LeadDiscoveryProfile {
  isEnabled: boolean;
  targetBusinessType: string;
  keywords: string[];
  locations: string[];
  batchSize: number;
  planMaxBatchSize: number | null;
  requiredFields: string[];
  phoneRequired: boolean;
  emailRequired: boolean;
  independentBusiness: boolean;
  minimumLeadScore: number;
  additionalCriteria: string[];
  autoCampaignEnabled: boolean;
  sourceCampaignId: string | null;
  sourceCampaignName: string | null;
  sourceCampaignStatus: string | null;
  updatedAt: string | null;
}

/** Body of PUT /lead-discovery/profile — replaces the whole profile. sourceCampaignId must reference
 * an existing, non-Stopped campaign whenever autoCampaignEnabled is true — the API 409s/404s
 * otherwise, but the UI should never let that request happen (see sourceCampaignIneligible). */
export interface SaveLeadDiscoveryProfileRequest {
  isEnabled: boolean;
  targetBusinessType: string;
  keywords: string[];
  locations: string[];
  batchSize: number;
  requiredFields: string[];
  phoneRequired: boolean;
  emailRequired: boolean;
  independentBusiness: boolean;
  minimumLeadScore: number;
  additionalCriteria: string[];
  autoCampaignEnabled: boolean;
  sourceCampaignId: string | null;
}

/** AutoCampaignEnrollmentDto — one auto-campaign enrollment outcome for one discovered customer, the
 * admin-facing audit trail behind autoCampaignEnabled. status is "Started", "Skipped" or "Failed";
 * reason explains a Skipped or Failed row. */
export interface AutoCampaignEnrollment {
  id: string;
  discoveredLeadId: string;
  businessName: string | null;
  customerId: string;
  sourceCampaignId: string | null;
  sourceCampaignName: string | null;
  executionCampaignId: string | null;
  executionCampaignName: string | null;
  executionDateLocal: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

/** Status chip tone for one AutoCampaignEnrollment.status value — reuses the same status-chip classes
 * as campaign/campaign-customer statuses elsewhere in this app. */
export function autoCampaignEnrollmentChipClass(status: string): string {
  switch (status) {
    case 'Started':
      return 'status-chip status-chip--running';
    case 'Failed':
      return 'status-chip status-chip--stopped';
    default:
      return 'status-chip status-chip--draft';
  }
}

/** DiscoveredLeadDto. Every row passed the tenant's qualification rules (qualificationStatus is
 * always "Qualified"). A phone number is only kept when it was found on phoneSourceUrl, so phone set
 * implies phoneVerified. A discovered business has not opted in to WhatsApp messages. */
export interface DiscoveredLead {
  id: string;
  businessName: string;
  businessType: string;
  contactPerson: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  sourceUrl: string;
  phoneVerified: boolean;
  phoneSourceUrl: string | null;
  qualificationStatus: string;
  leadScore: number;
  scoreRationale: string | null;
  /** The CRM customer created for this business, or null when it had no usable phone number. */
  customerId: string | null;
  discoveredAt: string;
}

/** LeadDiscoveryRunDto — what one run cost and produced. estimatedCostLocal is estimatedCostUsd in the
 * tenant's own currency (LeadDiscoverySpend.currencyCode), the same treatment a plan price gets. */
export interface LeadDiscoveryRun {
  id: string;
  ranAtUtc: string;
  model: string;
  rounds: number;
  candidatesConsidered: number;
  leadsSaved: number;
  duplicates: number;
  rejected: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
  webFetches: number;
  estimatedCostUsd: number;
  estimatedCostLocal: number;
}

/** costPerLeadUsd is zero when the period saved no leads. */
export interface LeadDiscoverySpendPeriod {
  runs: number;
  leadsSaved: number;
  estimatedCostUsd: number;
  estimatedCostLocal: number;
  costPerLeadUsd: number;
}

/** LeadDiscoverySpendDto. An estimate priced from configured list rates at the time of each run — close,
 * but the platform's own provider bill is the authority. Say so wherever these figures are shown. */
export interface LeadDiscoverySpend {
  currencyCode: string;
  currencySymbol: string;
  currentMonth: LeadDiscoverySpendPeriod;
  allTime: LeadDiscoverySpendPeriod;
  lastRunAtUtc: string | null;
}

/** Mirrors LeadDiscoveryLimits on the backend (SaveLeadDiscoveryProfileRequestValidator). */
export const LEAD_DISCOVERY_LIMITS = {
  maxBatchSize: 200,
  maxKeywords: 25,
  maxLocations: 25,
  maxAdditionalCriteria: 20,
  targetBusinessType: 200,
  keyword: 100,
  location: 200,
  criterion: 500,
} as const;

/** LeadDiscoveryFields on the backend — output fields a lead must have to qualify, beyond the business
 * name and source URL every lead carries — minus Phone and Email, which mean exactly what
 * phoneRequired/emailRequired mean (LeadQualification) and are offered only as those switches. */
export const LEAD_DISCOVERY_CHECKBOX_FIELDS = [
  { key: 'ContactPerson', label: 'Contact person' },
  { key: 'Address', label: 'Address' },
  { key: 'City', label: 'City' },
  { key: 'State', label: 'State' },
  { key: 'Website', label: 'Website' },
] as const;

export const MIN_SCORE_FILTERS = [90, 80, 70, 60, 50];

/** Same colour scale the profile's minimum score slider describes: strong, good, borderline. */
export function leadScoreChipClass(score: number): string {
  if (score >= 80) {
    return 'status-chip status-chip--running';
  }
  if (score >= 60) {
    return 'status-chip status-chip--scheduled';
  }
  return 'status-chip status-chip--draft';
}

/**
 * Adds one entry, or several split on `separator`, to `existing`: trimmed, inner whitespace collapsed,
 * blanks and case-insensitive duplicates skipped. Anything too long or past `maxCount` is reported in
 * `error` instead of added. Locations pass no separator — "Andheri West, Mumbai" is one location.
 */
export function addListEntries(
  existing: string[],
  raw: string,
  options: { maxLength: number; maxCount: number; noun: string; separator?: string }
): { values: string[]; error: string | null } {
  let values = existing;
  let error: string | null = null;
  const parts = options.separator ? raw.split(options.separator) : [raw];
  for (const part of parts) {
    const value = part.trim().replace(/\s+/g, ' ');
    if (!value) {
      continue;
    }
    if (value.length > options.maxLength) {
      error = `Each ${options.noun} can be at most ${options.maxLength} characters.`;
      continue;
    }
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      continue;
    }
    if (values.length >= options.maxCount) {
      error = `You can add up to ${options.maxCount} ${options.noun}s.`;
      break;
    }
    values = [...values, value];
  }
  return { values, error };
}

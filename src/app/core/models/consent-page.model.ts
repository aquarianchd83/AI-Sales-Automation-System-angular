/** The tenant's WhatsApp Consent Page: the product information and consent wording a customer sees before agreeing to WhatsApp messages. */

export type ConsentPageStatus = 'Incomplete' | 'Complete' | 'Published' | 'Inactive';

/** One thing missing or wrong, tied to the field to fix. `field` is the camelCase name of a form control. */
export interface ConsentPageIssue {
  field: string;
  message: string;
}

export interface ConsentPageSettings {
  businessName: string | null;
  productDescription: string | null;
  additionalInfo: string | null;
  consentStatement: string | null;
  /** The wording used when the statement is left blank. */
  defaultConsentStatement: string;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  status: ConsentPageStatus;
  isActive: boolean;
  publishedVersion: number;
  publishedAtUtc: string | null;
  /** The draft was saved after the last publish. */
  hasUnpublishedChanges: boolean;
  /** What stops this being published. Empty when it can be. */
  issues: ConsentPageIssue[];
}

export interface SaveConsentPageSettingsRequest {
  businessName: string | null;
  productDescription: string | null;
  additionalInfo: string | null;
  consentStatement: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
}

/** What the customer sees. The statement is the exact sentence shown beside the checkbox. */
export interface ConsentPageContent {
  businessName: string;
  productDescription: string;
  additionalInfo: string | null;
  consentStatement: string;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  version: number;
}

export interface ConsentPagePreview {
  page: ConsentPageContent;
  issues: ConsentPageIssue[];
}

/** Mirrors ConsentPageRules on the server, which is what actually enforces them. */
export const CONSENT_PAGE_LIMITS = {
  businessName: 120,
  productDescription: 1000,
  additionalInfo: 4000,
  consentStatement: 500,
  url: 500,
} as const;

/** A full https:// address with a real host - the same shape the server insists on. */
export const HTTPS_URL_PATTERN = /^https:\/\/[^\s/@:]+\.[^\s/@:]+(:\d+)?(\/\S*)?$/i;

/** True for text that looks like HTML. The server refuses it; this tells the tenant before they save. */
export function looksLikeMarkup(value: string): boolean {
  return /<\s*\/?\s*[a-zA-Z!]/.test(value);
}

export const CONSENT_STATUS_LABELS: Record<ConsentPageStatus, string> = {
  Incomplete: 'Incomplete',
  Complete: 'Complete - not published',
  Published: 'Published',
  Inactive: 'Inactive',
};

/** What each status means for customer discovery, in a sentence. */
export const CONSENT_STATUS_HELP: Record<ConsentPageStatus, string> = {
  Incomplete: 'Finish the required fields below, then publish. Customer discovery will not start until this is published.',
  Complete: 'Everything required is filled in. Publish it to allow customer discovery.',
  Published: 'Live. Customers who open your link see this page, and customer discovery can run.',
  Inactive: 'Switched off. Customer discovery will not start until you switch it back on or publish again.',
};

/** Where the "Complete Setup" button on the notification goes. */
export const CONSENT_PAGE_SETTINGS_ROUTE = '/consent-page-settings';

// ---- The customer's side (the page the SMS links to) ----

export type PublicConsentState = 'Ready' | 'Answered' | 'Unavailable' | 'Expired' | 'Invalid';

export interface PublicConsentPage {
  state: PublicConsentState;
  page: ConsentPageContent | null;
  /** Granted, NotInterested or Revoked once the customer has answered. */
  decision: string | null;
  message: string | null;
}

export type ConsentChoice = 'agree' | 'decline';

export interface ConsentDecisionRequest {
  decision: ConsentChoice;
  /** The checkbox. Required for "agree"; the server refuses an agree without it. */
  consentChecked: boolean;
  /** The version the customer was shown, so an agreement to a page that has since changed is refused. */
  pageVersion: number | null;
}

export type ConsentDecisionOutcome =
  | 'Recorded'
  | 'AlreadyRecorded'
  | 'Conflict'
  | 'Expired'
  | 'Invalid'
  | 'Unavailable'
  | 'PageChanged'
  | 'NotAllowed'
  | 'BadRequest';

export interface ConsentDecisionResult {
  outcome: ConsentDecisionOutcome;
  decision: string | null;
  message: string;
  /** Set when the page changed under the customer: the new page to review. */
  page: PublicConsentPage | null;
}

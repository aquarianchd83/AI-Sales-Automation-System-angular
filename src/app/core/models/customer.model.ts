/**
 * Customers.OptInStatus. The API serializes it as a string; these are the values
 * from the Phase 1 design doc. Only the status chip's colour depends on matching
 * them exactly — the raw value is what gets displayed.
 */
export enum OptInStatus {
  PendingOptIn = 'PendingOptIn',
  OptedIn = 'OptedIn',
  OptedOut = 'OptedOut',
}

/** CustomerDto. */
export interface Customer {
  id: string;
  phoneNumberE164: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  source: string | null;
  optInStatus: OptInStatus | string;
  optInTimestamp: string | null;
  /** How consent was captured — required whenever a customer is opted in. */
  optInSource: string | null;
  optOutTimestamp: string | null;
  /** How the opt-out was detected: ExactKeyword, PhrasePattern, AiDetected or Manual. Null for one
   * recorded before the field existed. An AiDetected opt-out is the one worth spot-checking — the
   * other three are deterministic. */
  optOutSource: string | null;
  preferredLanguage: string | null;
  assignedAgentId: string | null;
  tags: string[];
  createdAt: string;
}

/** CreateCustomerRequest — tags are not accepted here; add them separately. */
export interface CreateCustomerRequest {
  phoneNumberE164: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  source?: string | null;
  preferredLanguage?: string | null;
  assignedAgentId?: string | null;
}

/**
 * UpdateCustomerRequest. The phone number is editable and required — the API normalizes
 * it and returns 409 if it already belongs to another (or a soft-deleted) customer.
 */
export interface UpdateCustomerRequest {
  phoneNumberE164: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  source?: string | null;
  preferredLanguage?: string | null;
  assignedAgentId?: string | null;
}

/**
 * OptInCustomerRequest. `source` is required — consent with no recorded provenance is not
 * evidence. `capturedAt` defaults to now server-side and may not be in the future.
 */
export interface OptInCustomerRequest {
  source: string;
  capturedAt?: string | null;
}

/** OptInCustomerRequestValidator's MaximumLength on Source. */
export const OPT_IN_SOURCE_MAX_LENGTH = 100;

/** AddCustomerTagsRequest. This endpoint only adds — the API cannot remove a tag. */
export interface AddCustomerTagsRequest {
  tagNames: string[];
}

/** BulkDeleteCustomersRequest. */
export interface BulkDeleteCustomersRequest {
  ids: string[];
}

/**
 * BulkDeleteCustomersResultDto. `deletedCount` can be lower than `requestedCount` when
 * ids were already deleted or never existed — those come back in `notFoundIds`, and the
 * call still succeeds.
 */
export interface BulkDeleteCustomersResult {
  requestedCount: number;
  deletedCount: number;
  notFoundIds: string[];
}

/** Server-side cap (BulkDeleteCustomersRequestValidator.MaxIds). */
export const BULK_DELETE_MAX_IDS = 500;

/** CustomerImportResultDto — returned synchronously by POST /customers/import. */
export interface CustomerImportResult {
  totalRows: number;
  importedCount: number;
  skippedDuplicateCount: number;
  failedCount: number;
  rowErrors: CustomerImportRowError[];
}

export interface CustomerImportRowError {
  rowNumber: number;
  reason: string;
}

export function customerDisplayName(customer: Customer): string {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return name || customer.phoneNumberE164;
}

/** PascalCase enum name -> what a compliance reviewer needs to read off the screen. The wording
 * names the evidence, not the mechanism: "matched a phrase" is the fact being recorded. */
export function optOutSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case 'ExactKeyword':
      return 'Replied with an opt-out keyword';
    case 'PhrasePattern':
      return 'Message matched an opt-out phrase';
    case 'AiDetected':
      return 'The AI read the message as an opt-out';
    case 'Manual':
      return 'Set by a person';
    default:
      // Includes an opt-out recorded before the field existed — blank rather than a guess.
      return '—';
  }
}

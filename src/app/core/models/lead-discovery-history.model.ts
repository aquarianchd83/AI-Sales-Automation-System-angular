import { CustomerHistoryEvent } from './customer.model';
import { LeadDiscoveryRun } from './lead-discovery.model';
import { PagedQuery } from './paged-result.model';

/** Query for GET /lead-discovery/history — paged by processing date, each date carrying every
 * execution for it. status is a LeadDiscoveryExecutionStatus name (e.g. "RetryPending"). */
export interface LeadDiscoveryHistoryQuery extends PagedQuery {
  from?: string | null;
  to?: string | null;
  status?: string | null;
}

/** LeadDiscoveryExecutionSummaryDto — one execution in Lead Discovery History. Every *Status field is
 * an enum name from the backend (LeadDiscoveryExecutionStatus, LeadDiscoveryLockStatus,
 * LeadDiscoveryCampaignStatus, LeadDiscoveryAssociationStatus) — see leadDiscoveryStatusChipClass.
 * estimatedCostLocal is the linked run's cost in the tenant's own currency — zero when the execution
 * did no research (a retry, or a run skipped before it started); currencyCode/currencySymbol are the
 * tenant's currency regardless, so a zero still reads correctly. */
export interface LeadDiscoveryExecutionSummary {
  id: string;
  processingDate: string;
  leadDiscoveryProfileId: string;
  profileName: string;
  trigger: string;
  status: string;
  startedAtUtc: string;
  endedAtUtc: string | null;
  lockStatus: string;
  /** The tenant's lead-candidate quota ran out mid-run, so discovery stopped before reaching the
   * profile's batch size — fewer customers than requested is expected here, not a failure. */
  quotaExhausted: boolean;
  customersDiscovered: number;
  customersCreated: number;
  customersDuplicate: number;
  customersInvalid: number;
  customersFailed: number;
  customersSkipped: number;
  autoCampaignConfigured: boolean;
  autoCampaignId: string | null;
  referredCampaignId: string | null;
  referredCampaignName: string | null;
  generatedCampaignId: string | null;
  generatedCampaignName: string | null;
  campaignStatus: string;
  campaignNote: string | null;
  templateStatus: string;
  mappingStatus: string;
  mappingsEligible: number;
  mappingsCreated: number;
  mappingsExisting: number;
  mappingsFailed: number;
  rootExecutionId: string;
  retryOfExecutionId: string | null;
  supersededByExecutionId: string | null;
  retryCount: number;
  lastRetryAtUtc: string | null;
  failedStep: string | null;
  errorMessage: string | null;
  nextRetryInfo: string | null;
  canRetry: boolean;
  estimatedCostLocal: number;
  currencyCode: string;
  currencySymbol: string;
}

/** LeadDiscoveryHistoryDayDto — one processing date and every execution that belongs to it. */
export interface LeadDiscoveryHistoryDay {
  processingDate: string;
  executions: LeadDiscoveryExecutionSummary[];
}

export interface LeadDiscoveryExecutionCustomer {
  id: string;
  customerId: string | null;
  discoveredLeadId: string | null;
  customerName: string;
  phone: string | null;
  status: string;
  isInvalid: boolean;
  errorMessage: string | null;
  errorDetails: string | null;
  retriedFromId: string | null;
  processedAtUtc: string | null;
  /** The DND / outreach-eligibility check on the number: NotChecked, Pending, Pass, Fail or Error. */
  verificationStatus: string;
  /** The provider's code for a Fail or Error, e.g. "DND". */
  verificationReasonCode: string | null;
  verificationReason: string | null;
  verifiedAtUtc: string | null;
  /** The name on the CRM customer created for this row; null when none exists (rejected, invalid, duplicate) or it was deleted. */
  crmCustomerName?: string | null;
  /** The campaign this execution generated, when this row's customer was added to it. */
  campaignName?: string | null;
  /** The SMS inviting the customer to chat on WhatsApp: Pending, Submitted, Delivered or Failed; null when none was sent. Submitted is not delivered. */
  consentSmsStatus?: string | null;
  consentSmsFailureReason?: string | null;
  /** When the customer's own WhatsApp message answered the invitation and consent was recorded; null until then. */
  consentRecordedAtUtc?: string | null;
}

/**
 * The history of a row that has no customer - a number the DND check rejected, a closed or unverifiable business - built from the
 * row itself, since no customer exists to carry history events. Same shape as a customer's own history, so one dialog shows both.
 */
export function rowHistoryEvents(row: LeadDiscoveryExecutionCustomer): CustomerHistoryEvent[] {
  const base = { previousStatus: null, correlationId: null, providerReference: null, executionId: null, campaignId: null };
  const events: CustomerHistoryEvent[] = [
    {
      ...base,
      id: `${row.id}-discovered`,
      eventType: 'Discovered',
      // Never later than the check that followed it: the row is saved after the number is checked, but the business was found first.
      occurredAtUtc: row.verifiedAtUtc ?? row.processedAtUtc ?? '',
      newStatus: 'Discovered',
      reason: null,
    },
  ];

  if (row.verificationStatus !== 'NotChecked') {
    const at = row.verifiedAtUtc ?? '';
    events.push(
      { ...base, id: `${row.id}-submitted`, eventType: 'VerificationSubmitted', occurredAtUtc: at, previousStatus: 'NotChecked', newStatus: 'Pending', reason: null },
      {
        ...base,
        id: `${row.id}-verified`,
        eventType: `Verification${row.verificationStatus === 'Pass' ? 'Passed' : row.verificationStatus === 'Fail' ? 'Failed' : 'Error'}`,
        occurredAtUtc: at,
        previousStatus: 'Pending',
        newStatus: row.verificationStatus,
        reason: row.verificationReason ?? row.verificationReasonCode,
      }
    );
  }

  // A row still waiting (Pending) has not ended up anywhere yet; every other row ended without a customer.
  if (row.status !== 'Pending') {
    events.push({
      ...base,
      id: `${row.id}-not-created`,
      eventType: 'CustomerNotCreated',
      occurredAtUtc: row.processedAtUtc ?? '',
      newStatus: row.status,
      reason: row.errorMessage,
    });
  }

  return events;
}

/** What the Consent SMS column says. Submitted (accepted by the provider) and Delivered (confirmed by its receipt) are kept apart on purpose. */
export function consentSmsLabel(status: string | null | undefined): string {
  switch (status) {
    case 'Pending':
      return 'Queued';
    case 'Submitted':
      return 'Submitted';
    case 'Delivered':
      return 'Delivered';
    case 'Failed':
      return 'Failed';
    default:
      return '—';
  }
}

export function consentSmsChipClass(status: string | null | undefined): string {
  switch (status) {
    case 'Delivered':
      return 'status-chip status-chip--completed';
    case 'Failed':
      return 'status-chip status-chip--opted-out';
    case 'Submitted':
      return 'status-chip status-chip--scheduled';
    case 'Pending':
      return 'status-chip status-chip--pending';
    default:
      return 'status-chip status-chip--inactive';
  }
}

/** The choices of the DND check filter on the Customers tab: every verification status, plus "All". */
export const VERIFICATION_FILTERS = [
  { value: 'All', label: 'All' },
  { value: 'Pass', label: 'Passed' },
  { value: 'Fail', label: 'Failed' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Error', label: 'Check error' },
  { value: 'NotChecked', label: 'Not checked' },
] as const;

/** The rows whose verification status is `filter` ('All' keeps every row). */
export function filterByVerification(
  rows: LeadDiscoveryExecutionCustomer[],
  filter: string
): LeadDiscoveryExecutionCustomer[] {
  return filter === 'All' ? rows : rows.filter((r) => r.verificationStatus === filter);
}

/** What the DND column says for a verificationStatus. Fail (rejected) and Error (could not be checked) read differently on purpose. */
export function verificationLabel(status: string): string {
  switch (status) {
    case 'Pass':
      return 'Passed';
    case 'Fail':
      return 'Failed';
    case 'Error':
      return 'Check error';
    case 'Pending':
      return 'Pending';
    default:
      return '—';
  }
}

/** Green for Pass, red for Fail, amber for Error (retryable), blue while Pending, grey when never checked. */
export function verificationChipClass(status: string): string {
  switch (status) {
    case 'Pass':
      return 'status-chip status-chip--completed';
    case 'Fail':
      return 'status-chip status-chip--opted-out';
    case 'Error':
      return 'status-chip status-chip--pending';
    case 'Pending':
      return 'status-chip status-chip--scheduled';
    default:
      return 'status-chip status-chip--inactive';
  }
}

export interface LeadDiscoveryExecutionTemplate {
  id: string;
  templateId: string | null;
  templateName: string;
  sequence: number;
  delayDaysAfterPrevious: number;
  campaignStepId: string | null;
  status: string;
  errorMessage: string | null;
}

export interface LeadDiscoveryLockTransition {
  id: string;
  fromStatus: string;
  toStatus: string;
  transitionAtUtc: string;
  lockTokenReference: string | null;
  ownerInstanceId: string | null;
  reason: string | null;
  error: string | null;
}

/** LeadDiscoveryExecutionDetailDto — everything recorded about one execution. research is what this
 * execution's AI research used and cost — null when it did no research: a retry, a skipped or blocked
 * run, a run stopped before its first round, or one recorded before runs were linked to executions.
 * currencyCode/currencySymbol are the tenant's currency, for research.estimatedCostLocal. */
/** LeadDiscoveryVerificationCountsDto - how the execution's numbers came out of the DND check. Pending and Error are still to be
 * checked (a retry asks again); failed numbers never became customers; notChecked rows were never submitted (invalid, duplicate, or
 * the check was off). The five add up to the rows the execution recorded. */
export interface LeadDiscoveryVerificationCounts {
  passed: number;
  failed: number;
  pending: number;
  error: number;
  notChecked: number;
}

export interface LeadDiscoveryExecutionDetail {
  execution: LeadDiscoveryExecutionSummary;
  lockKey: string;
  lockTokenReference: string | null;
  lockOwnerInstanceId: string | null;
  lockAcquiredAtUtc: string | null;
  lockExpiresAtUtc: string | null;
  lockLastRenewedAtUtc: string | null;
  errorDetails: string | null;
  summary: string | null;
  customers: LeadDiscoveryExecutionCustomer[];
  templates: LeadDiscoveryExecutionTemplate[];
  lockTransitions: LeadDiscoveryLockTransition[];
  research: LeadDiscoveryRun | null;
  currencyCode: string;
  currencySymbol: string;
  verificationCounts: LeadDiscoveryVerificationCounts;
}

/** LeadDiscoveryRetryQueuedDto — a manual retry was queued; it runs as a new execution. */
export interface LeadDiscoveryRetryQueued {
  executionId: string;
  backgroundJobId: string;
}

/** Execution statuses (LeadDiscoveryExecutionStatus), for the status filter dropdown. */
export const LEAD_DISCOVERY_EXECUTION_STATUSES = [
  'Started',
  'Processing',
  'Completed',
  'PartiallyCompleted',
  'Failed',
  'RetryPending',
  'Retrying',
] as const;

/**
 * Status chip tone for any status string this screen displays — execution, lock, campaign, template
 * or mapping status. These are separate enums on the backend but share enough vocabulary (Pending,
 * Processing, Completed, Failed, ...) that one mapping reads consistently across every column: green
 * for a settled success, red for a settled failure, amber for something waiting on a retry, blue for
 * work in progress, and grey for anything else (not applicable, never started).
 */
export function leadDiscoveryStatusChipClass(status: string): string {
  switch (status) {
    case 'Completed':
    case 'Created':
    case 'Released':
      return 'status-chip status-chip--completed';
    case 'PartiallyCompleted':
    case 'RetryPending':
    case 'RenewalFailed':
      return 'status-chip status-chip--pending';
    case 'Failed':
    case 'Blocked':
    case 'Expired':
    case 'Lost':
      return 'status-chip status-chip--opted-out';
    case 'Processing':
    case 'Retrying':
    case 'Started':
    case 'Creating':
    case 'Acquiring':
    case 'Acquired':
    case 'Renewing':
    case 'ReleasePending':
      return 'status-chip status-chip--scheduled';
    default:
      // Pending, Skipped, and anything not otherwise recognised — a neutral "not applicable" tone.
      return 'status-chip status-chip--inactive';
  }
}

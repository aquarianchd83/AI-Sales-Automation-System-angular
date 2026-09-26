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
 * LeadDiscoveryCampaignStatus, LeadDiscoveryAssociationStatus) — see leadDiscoveryStatusChipClass. */
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

/** LeadDiscoveryExecutionDetailDto — everything recorded about one execution. */
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

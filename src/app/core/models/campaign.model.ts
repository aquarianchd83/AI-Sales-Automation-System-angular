/** Campaign.Status. */
export enum CampaignStatus {
  Draft = 'Draft',
  Scheduled = 'Scheduled',
  Running = 'Running',
  Paused = 'Paused',
  Stopped = 'Stopped',
  Completed = 'Completed',
}

/** CampaignStepType — numeric value doubles as send order (0 = Initial, 1-4 = follow-ups). */
export enum CampaignStepType {
  Initial = 'Initial',
  FollowUp1 = 'FollowUp1',
  FollowUp2 = 'FollowUp2',
  FollowUp3 = 'FollowUp3',
  FollowUp4 = 'FollowUp4',
}

/** In send order — used to drive the "add step" menu and to sort a campaign's steps. */
export const CAMPAIGN_STEP_TYPES_IN_ORDER: CampaignStepType[] = [
  CampaignStepType.Initial,
  CampaignStepType.FollowUp1,
  CampaignStepType.FollowUp2,
  CampaignStepType.FollowUp3,
  CampaignStepType.FollowUp4,
];

/**
 * CampaignCustomerStatus — the keys of CampaignProgressDto.byStatus. Which step a customer is
 * on is not part of this enum (it lives in CurrentStepNumber, not exposed here) — collapsing
 * "InitialSent", "FollowUp1Sent" etc. into AwaitingResponse keeps this small.
 */
export enum CampaignCustomerStatus {
  Pending = 'Pending',
  AwaitingResponse = 'AwaitingResponse',
  Responded = 'Responded',
  OptedOut = 'OptedOut',
  HandedOff = 'HandedOff',
  Completed = 'Completed',
  Failed = 'Failed',
}

/** Display order for the progress breakdown — active states first, terminal states after. */
export const CAMPAIGN_CUSTOMER_STATUS_ORDER: CampaignCustomerStatus[] = [
  CampaignCustomerStatus.Pending,
  CampaignCustomerStatus.AwaitingResponse,
  CampaignCustomerStatus.Responded,
  CampaignCustomerStatus.HandedOff,
  CampaignCustomerStatus.Completed,
  CampaignCustomerStatus.OptedOut,
  CampaignCustomerStatus.Failed,
];

/**
 * Server defaults from CampaignOptions ("Campaigns" config section) — configurable there, so
 * these are a fast-fail hint for the form, not the authority. The server re-validates regardless.
 */
export const DEFAULT_MIN_STEP_MEDIA = 2;
export const DEFAULT_MAX_STEP_MEDIA = 5;

export interface CampaignStep {
  id: string;
  stepType: CampaignStepType | string;
  stepNumber: number;
  delayDaysAfterPrevious: number;
  messageText: string | null;
  messageTemplateId: string | null;
  messageTemplateName: string | null;
  isActive: boolean;
  mediaAssetIds: string[];
}

/** CampaignDto. Steps arrive embedded — there is no separate steps list endpoint. */
export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus | string;
  scheduledStartAt: string | null;
  createdBy: string;
  startedAt: string | null;
  stoppedAt: string | null;
  audienceCount: number;
  steps: CampaignStep[];
  createdAt: string;
}

export interface CreateCampaignRequest {
  name: string;
  description?: string | null;
  scheduledStartAt?: string | null;
}

export type UpdateCampaignRequest = CreateCampaignRequest;

export interface UpsertCampaignStepRequest {
  stepType: string;
  delayDaysAfterPrevious: number;
  messageText: string;
  messageTemplateId?: string | null;
  mediaAssetIds: string[];
  isActive: boolean;
}

/**
 * SetCampaignAudienceRequest. There is no endpoint to list or remove a campaign's attached
 * customers — only to add more by tag or id — so the UI can show a count but not a roster.
 */
export interface SetCampaignAudienceRequest {
  tagNames?: string[];
  customerIds?: string[];
}

export interface SetCampaignAudienceResult {
  totalMatched: number;
  addedCount: number;
  alreadyAttachedCount: number;
  notOptedInCount: number;
}

export interface CampaignProgress {
  campaignId: string;
  totalCustomers: number;
  byStatus: Record<string, number>;
}

export interface SendRunResult {
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
}

/** RunJobsResultDto — response of the global (not per-campaign) ops/run-jobs trigger. */
export interface RunJobsResult {
  initialSends: SendRunResult;
  followUps: SendRunResult;
  retries: SendRunResult;
}

/** CampaignService.RequireStatus rules, mirrored so the UI never offers an action the API refuses. */
export function canEditCampaign(status: string): boolean {
  return status === CampaignStatus.Draft;
}

export function canDeleteCampaign(status: string): boolean {
  return status === CampaignStatus.Draft;
}

export function canEditSteps(status: string): boolean {
  return status === CampaignStatus.Draft || status === CampaignStatus.Paused;
}

export function canSetAudience(status: string): boolean {
  return status !== CampaignStatus.Stopped && status !== CampaignStatus.Completed;
}

export function canStartCampaign(status: string): boolean {
  return status === CampaignStatus.Draft;
}

export function canResumeCampaign(status: string): boolean {
  return status === CampaignStatus.Paused;
}

export function canPauseCampaign(status: string): boolean {
  return status === CampaignStatus.Running || status === CampaignStatus.Scheduled;
}

export function canStopCampaign(status: string): boolean {
  return status !== CampaignStatus.Stopped && status !== CampaignStatus.Completed;
}

export function campaignStatusChipClass(status: string): string {
  switch (status) {
    case CampaignStatus.Running:
      return 'status-chip status-chip--running';
    case CampaignStatus.Scheduled:
      return 'status-chip status-chip--scheduled';
    case CampaignStatus.Paused:
      return 'status-chip status-chip--paused';
    case CampaignStatus.Stopped:
      return 'status-chip status-chip--stopped';
    case CampaignStatus.Completed:
      return 'status-chip status-chip--completed';
    default:
      return 'status-chip status-chip--draft';
  }
}

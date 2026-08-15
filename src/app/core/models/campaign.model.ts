/** Campaign.Status. */
export enum CampaignStatus {
  Draft = 'Draft',
  Scheduled = 'Scheduled',
  Running = 'Running',
  Paused = 'Paused',
  Stopped = 'Stopped',
  Completed = 'Completed',
}

/**
 * A campaign step's display name is derived from its position, not a fixed set of
 * members — CampaignStepTypeName on the backend replaced what used to be a closed
 * CampaignStepType enum (Initial + FollowUp1-4 only) specifically so a campaign can
 * carry any number of follow-ups. 0 is always "Initial"; every StepNumber above 0 is
 * "FollowUp{N}". Mirror these two functions exactly, or the two sides part ways on what
 * a given step is called.
 */
export function formatStepTypeName(stepNumber: number): string {
  return stepNumber <= 0 ? 'Initial' : `FollowUp${stepNumber}`;
}

const FOLLOW_UP_PATTERN = /^FollowUp(\d+)$/i;

/** Inverse of formatStepTypeName. Returns null for anything that isn't "Initial" or
 * "FollowUp" followed by a positive integer. */
export function parseStepTypeName(value: string): number | null {
  if (value.trim().toLowerCase() === 'initial') {
    return 0;
  }
  const match = FOLLOW_UP_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const n = Number(match[1]);
  return n > 0 ? n : null;
}

/**
 * CampaignService.UpsertStepAsync requires every earlier position (Initial included) to
 * already exist before a step can be attached — the send pipeline walks the sequence one
 * position at a time and a true gap (no step there at all, not just an inactive one)
 * makes it give up and mark the customer Completed, silently dropping every follow-up
 * after the gap. So there is always exactly one addable position: one past whatever is
 * highest right now (0 — Initial — if the campaign has no steps yet). There is no upper
 * bound, unlike the fixed FollowUp1-4 set this replaced.
 */
export function nextStepNumber(steps: { stepNumber: number }[]): number {
  return steps.length === 0 ? 0 : Math.max(...steps.map((s) => s.stepNumber)) + 1;
}

/**
 * Mirrors RemoveStepAsync's matching rule: a step can only be removed if it is the last
 * one in the sequence — removing one out from under a later step would open the same
 * unfillable gap nextStepNumber exists to prevent on the way in.
 */
export function isLastStep(stepNumber: number, allStepNumbers: number[]): boolean {
  return !allStepNumbers.some((n) => n > stepNumber);
}

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
  /** "Initial" or "FollowUp{N}" — see formatStepTypeName/parseStepTypeName. */
  stepType: string;
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

/**
 * CampaignAudienceMemberDto — one row of the roster behind SetCampaignAudienceResult's
 * counts. `currentStepNumber` is -1 until the first message actually sends.
 */
export interface CampaignAudienceMember {
  customerId: string;
  phoneNumberE164: string;
  firstName: string | null;
  lastName: string | null;
  status: CampaignCustomerStatus | string;
  currentStepNumber: number;
  lastMessageSentAt: string | null;
  nextFollowUpDueAt: string | null;
  stoppedReason: string | null;
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

/**
 * CampaignService.RequireStatus rules, mirrored so the UI never offers an action the API
 * refuses. Edit is Draft, Scheduled, or Paused — a Scheduled campaign hasn't sent anything
 * yet, so its name/description/date are still safe to change; Running is excluded since a
 * live campaign's schedule should not shift under it. Clearing the date on a Scheduled
 * campaign falls it back to Draft server-side (nothing would ever promote it out of
 * Scheduled again with no date to promote on).
 */
export function canEditCampaign(status: string): boolean {
  return (
    status === CampaignStatus.Draft ||
    status === CampaignStatus.Scheduled ||
    status === CampaignStatus.Paused
  );
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

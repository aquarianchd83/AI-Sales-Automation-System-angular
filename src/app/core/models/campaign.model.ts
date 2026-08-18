/** Campaign.Status. */
export enum CampaignStatus {
  Draft = 'Draft',
  Scheduled = 'Scheduled',
  Running = 'Running',
  Paused = 'Paused',
  Stopped = 'Stopped',
  Completed = 'Completed',
}

/** Display order for the campaign status legend — lifecycle order, not alphabetical. */
export const CAMPAIGN_STATUS_ORDER: CampaignStatus[] = [
  CampaignStatus.Draft,
  CampaignStatus.Scheduled,
  CampaignStatus.Running,
  CampaignStatus.Paused,
  CampaignStatus.Stopped,
  CampaignStatus.Completed,
];

/** One-line description for each status, shown as the legend chip's tooltip. */
export const CAMPAIGN_STATUS_DESCRIPTIONS: Record<CampaignStatus, string> = {
  [CampaignStatus.Draft]: 'Not started yet. Name, description, steps and audience can all still be edited freely, and it can be deleted.',
  [CampaignStatus.Scheduled]: 'Has a future scheduled start date/time and will begin sending automatically once that time arrives.',
  [CampaignStatus.Running]: 'Actively sending Initial messages and follow-ups to its audience right now.',
  [CampaignStatus.Paused]: 'Temporarily halted — sending stops, but steps stay editable and it can be resumed from where it left off.',
  [CampaignStatus.Stopped]: 'Manually stopped. Everyone still awaiting a follow-up was force-completed. Can be resumed or deleted (deleting also erases its message history).',
  [CampaignStatus.Completed]: 'Every step in the sequence has finished for the whole audience.',
};

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

/**
 * CampaignService.DeleteAsync: Draft or Stopped only, hard delete. A Draft campaign never
 * has Messages (nothing sends before Start), so there's nothing to lose; a Stopped one
 * usually does, and DeleteAsync removes those right along with it — there is no way to
 * keep a record of what was sent once the campaign itself is gone. Anything still live
 * (Scheduled/Running/Paused) must be Stopped first.
 */
export function canDeleteCampaign(status: string): boolean {
  return status === CampaignStatus.Draft || status === CampaignStatus.Stopped;
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
  return status === CampaignStatus.Paused || status === CampaignStatus.Stopped;
}

export function canPauseCampaign(status: string): boolean {
  return status === CampaignStatus.Running || status === CampaignStatus.Scheduled;
}

export function canStopCampaign(status: string): boolean {
  return status !== CampaignStatus.Stopped && status !== CampaignStatus.Completed;
}

/**
 * Not a field the API returns — CampaignDto has no end-date concept server-side (see
 * CampaignDtos.cs). This projects one client-side:
 *  - A Stopped campaign's real end is StoppedAt — it actually stopped there, so this is
 *    exact, not an estimate.
 *  - Otherwise it's an estimate: the start date (StartedAt once running, else
 *    ScheduledStartAt) plus the total delay across every currently active step. This
 *    mirrors CampaignSendService.ProcessOneAsync, which schedules each active step's
 *    NextFollowUpDueAt as `now.AddDays(step.DelayDaysAfterPrevious)` off of whenever the
 *    previous one actually sent — summing every active step's own delay gives the same
 *    total regardless of send order, since it's a plain sum.
 *  - null when there isn't a start date yet at all (Draft with nothing scheduled), or when
 *    there isn't at least one active step yet — with no steps configured there is nothing
 *    to project a finish from, and start-date-plus-zero would silently read as "finishes
 *    the same day it starts" instead of "not calculable yet". Recomputes automatically as
 *    steps are added, since this reads straight off campaign.steps every time it's called.
 * Inactive steps contribute nothing: the send pipeline skips them entirely rather than
 * pausing on them (see isLastStep's remarks on gap-tolerance).
 */
export interface CampaignEndDate {
  date: Date;
  /** false only for a Stopped campaign's actual StoppedAt. */
  isEstimate: boolean;
}

export function campaignEndDate(campaign: {
  status: string;
  startedAt?: string | null;
  scheduledStartAt?: string | null;
  stoppedAt?: string | null;
  steps: { isActive: boolean; delayDaysAfterPrevious: number }[];
}): CampaignEndDate | null {
  if (campaign.status === CampaignStatus.Stopped && campaign.stoppedAt) {
    return { date: new Date(campaign.stoppedAt), isEstimate: false };
  }

  const startAt = campaign.startedAt ?? campaign.scheduledStartAt;
  if (!startAt) {
    return null;
  }

  const activeSteps = campaign.steps.filter((s) => s.isActive);
  if (activeSteps.length === 0) {
    return null;
  }

  const totalDelayDays = activeSteps.reduce((sum, s) => sum + s.delayDaysAfterPrevious, 0);

  const date = new Date(startAt);
  date.setDate(date.getDate() + totalDelayDays);
  return { date, isEstimate: true };
}

/**
 * Campaign.ScheduledStartAt is compared against IST, and the backend reads a request's
 * literal digits as IST — ignoring any 'Z'/offset suffix entirely (see
 * CreateCampaignRequest / Campaign.ScheduledStartAt's doc comments). `Date.toISOString()`
 * converts through UTC first, so for any timezone ahead of UTC (IST included) it silently
 * rolls a locally-picked midnight back onto the previous calendar day before the backend
 * ever sees it — the exact "picking the previous day" bug this exists to avoid. This
 * writes the Date's own local year/month/day/time fields (what the datepicker actually
 * set) out as literal digits instead, with no timezone conversion at all.
 *
 * `time`, if given, is an "HH:mm" string (a native `<input type="time">`'s value) that
 * overrides the date's own hour/minute — the datepicker's calendar UI only ever carries a
 * date, so the time-of-day has to come from a second, separate control.
 */
export function toScheduledStartAtRequest(date: Date, time?: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const seconds = time ? 0 : date.getSeconds();
  if (time) {
    const [h, m] = time.split(':').map(Number);
    hours = Number.isFinite(h) ? h : 0;
    minutes = Number.isFinite(m) ? m : 0;
  }
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  );
}

/** "HH:mm" for a native `<input type="time">`, from the same Date the time is later
 * combined back onto via toScheduledStartAtRequest — round-trips a campaign's existing
 * ScheduledStartAt into the time field when opening the form to edit it. */
export function toTimeInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

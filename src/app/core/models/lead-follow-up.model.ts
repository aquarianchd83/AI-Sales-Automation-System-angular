/** LeadFollowUp.Status. Scheduled is the only state the sender looks at; the rest is history. */
export enum LeadFollowUpStatus {
  Scheduled = 'Scheduled',
  Sent = 'Sent',
  Cancelled = 'Cancelled',
  /** Not sent because the customer got in touch on their own after it was scheduled. */
  Skipped = 'Skipped',
  /** WhatsApp refused the send; "Send now" retries it. */
  Failed = 'Failed',
  /** Proposed by the AI because the customer said they are interested but cannot go ahead. Nothing is sent from
   * this state: a person confirms it (choosing the message) or dismisses it. */
  Suggested = 'Suggested',
}

/** The history views of the follow-up list — every status but Scheduled. */
export const FOLLOW_UP_HISTORY_STATUSES: LeadFollowUpStatus[] = [
  LeadFollowUpStatus.Sent,
  LeadFollowUpStatus.Failed,
  LeadFollowUpStatus.Skipped,
  LeadFollowUpStatus.Cancelled,
];

/** The quick waits offered when parking a lead. The API accepts 1-12 months or an exact date. */
export const FOLLOW_UP_MONTH_CHOICES = [1, 2, 3];

/** Mirrors LeadFollowUpPolicy on the API - the server enforces these, they are repeated here so the form can say so. */
export const FOLLOW_UP_MIN_DAYS_AHEAD = 7;
export const FOLLOW_UP_MAX_MONTHS = 12;
export const FOLLOW_UP_MAX_SENT_PER_LEAD = 3;

/** LeadFollowUpDto. */
export interface LeadFollowUp {
  id: string;
  leadId: string;
  customerId: string;
  customerName: string;
  customerPhoneNumberE164: string;
  leadStage: string;
  status: LeadFollowUpStatus | string;
  /** UTC. */
  dueAt: string;
  /** The 1/2/3-month choice it was scheduled from, or null when an exact date was picked. */
  intervalMonths: number | null;
  reason: string | null;
  /** Null while it is only the AI suggestion. */
  messageTemplateId: string | null;
  messageTemplateName: string | null;
  /** 1 for the first follow-up of the lead, 2 for the next. */
  followUpNumber: number;
  sentAt: string | null;
  /** Why it was cancelled/skipped/failed. */
  outcomeNote: string | null;
  createdAt: string;
}

/** ScheduleLeadFollowUpRequest. Exactly one of months / dueAt. */
export interface ScheduleLeadFollowUpRequest {
  months: number | null;
  dueAt: string | null;
  messageTemplateId: string;
  reason: string | null;
}

/** LeadFollowUpSummaryDto. */
export interface LeadFollowUpSummary {
  scheduled: number;
  dueNow: number;
  dueWithin30Days: number;
  sent: number;
  /** What the AI proposed that nobody has confirmed or dismissed yet. */
  suggested: number;
}

export function followUpStatusChipClass(status: string): string {
  switch (status) {
    case LeadFollowUpStatus.Scheduled:
      return 'status-chip status-chip--scheduled';
    case LeadFollowUpStatus.Sent:
      return 'status-chip status-chip--completed';
    case LeadFollowUpStatus.Failed:
      return 'status-chip status-chip--stopped';
    case LeadFollowUpStatus.Skipped:
      return 'status-chip status-chip--paused';
    case LeadFollowUpStatus.Suggested:
      return 'status-chip status-chip--running';
    default:
      return 'status-chip status-chip--draft';
  }
}

/** "In 2 months" / "On 12 Jan" - what the customer was parked for, in the words the agent chose. */
export function followUpWaitLabel(followUp: Pick<LeadFollowUp, 'intervalMonths'>): string {
  const months = followUp.intervalMonths;
  return months ? `${months} month${months === 1 ? '' : 's'}` : 'Custom date';
}

/** Past its due date and still waiting - the sender holds it for daytime hours, a quiet period or quota. */
export function isFollowUpOverdue(followUp: Pick<LeadFollowUp, 'status' | 'dueAt'>, now = new Date()): boolean {
  return followUp.status === LeadFollowUpStatus.Scheduled && new Date(followUp.dueAt).getTime() <= now.getTime();
}

/** A Scheduled or Failed follow-up can still be sent or cancelled by a person. */
export function isFollowUpActionable(status: string): boolean {
  return status === LeadFollowUpStatus.Scheduled || status === LeadFollowUpStatus.Failed;
}

/** The AI unconfirmed proposal: reviewed on the lead, where the message is chosen, or dismissed. */
export function isFollowUpSuggestion(status: string): boolean {
  return status === LeadFollowUpStatus.Suggested;
}

/** Lead.Stage. Forward-moving in the normal case (New -> ... -> Won/Lost), but nothing in the
 * domain enforces monotonicity — a Negotiation can slip back to Qualifying, an agent can correct
 * a mistaken stage — so this is a plain settable value, not a state machine. */
export enum LeadStage {
  New = 'New',
  Qualifying = 'Qualifying',
  Qualified = 'Qualified',
  Negotiation = 'Negotiation',
  Won = 'Won',
  Lost = 'Lost',
}

/** Display order for the pipeline board — New through Won, Lost last. */
export const LEAD_STAGE_ORDER: LeadStage[] = [
  LeadStage.New,
  LeadStage.Qualifying,
  LeadStage.Qualified,
  LeadStage.Negotiation,
  LeadStage.Won,
  LeadStage.Lost,
];

/** Lead.Score — coarse, human-facing bucket derived from ScoreNumeric (backend thresholds:
 * >=70 Hot, >=40 Warm, else Cold — see LeadService.BandFor). Shared with
 * Conversation.LastLeadScore so the inbox and the pipeline board agree on the same read of
 * "how hot is this lead." */
export enum LeadScoreBand {
  Cold = 'Cold',
  Warm = 'Warm',
  Hot = 'Hot',
}

/** LeadActivity.ActivityType — what kind of change one timeline row records. */
export enum LeadActivityType {
  ScoreChanged = 'ScoreChanged',
  StageChanged = 'StageChanged',
  Note = 'Note',
  AssignmentChanged = 'AssignmentChanged',
}

/** LeadDto. Customer phone/name arrive denormalized, same as ConversationDto/HandoffDto. */
export interface Lead {
  id: string;
  customerId: string;
  customerPhoneNumberE164: string;
  customerName: string;
  campaignId: string | null;
  stage: LeadStage | string;
  score: LeadScoreBand | string;
  scoreNumeric: number;
  budget: string | null;
  interest: string | null;
  purchaseTimeline: string | null;
  assignedTo: string | null;
  lastActivityAt: string | null;
  createdAt: string;
}

/** LeadActivityDto — one row of a lead's history (AI-driven score/stage changes have
 * createdBy null; manual notes and corrections carry the acting user's id). */
export interface LeadActivity {
  id: string;
  activityType: LeadActivityType | string;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

/**
 * UpdateLeadRequest. All fields optional — only supplied ones change. Stage is the only field
 * a manual edit can change that the AI also writes to automatically (AI-driven rescoring never
 * touches Stage itself, only Score/ScoreNumeric).
 */
export interface UpdateLeadRequest {
  stage?: string | null;
  budget?: string | null;
  interest?: string | null;
  purchaseTimeline?: string | null;
}

export interface AssignLeadRequest {
  agentId: string;
}

export interface AddLeadActivityRequest {
  note: string;
}

export function leadStageChipClass(stage: string): string {
  switch (stage) {
    case LeadStage.New:
      return 'status-chip status-chip--draft';
    case LeadStage.Qualifying:
      return 'status-chip status-chip--scheduled';
    case LeadStage.Qualified:
      return 'status-chip status-chip--running';
    case LeadStage.Negotiation:
      return 'status-chip status-chip--paused';
    case LeadStage.Won:
      return 'status-chip status-chip--completed';
    case LeadStage.Lost:
      return 'status-chip status-chip--stopped';
    default:
      return 'status-chip status-chip--draft';
  }
}

export function leadScoreChipClass(score: string): string {
  switch (score) {
    case LeadScoreBand.Hot:
      return 'status-chip status-chip--stopped';
    case LeadScoreBand.Warm:
      return 'status-chip status-chip--paused';
    case LeadScoreBand.Cold:
      return 'status-chip status-chip--scheduled';
    default:
      return 'status-chip status-chip--draft';
  }
}

/** A closed-out lead (Won or Lost) is history — LeadService.UpdateAsync doesn't actually block
 * editing one, but offering stage/budget/interest edits on a deal that's already done or dead
 * invites accidental changes to a closed record; hidden rather than blocked. */
export function canEditLead(stage: string): boolean {
  return stage !== LeadStage.Won && stage !== LeadStage.Lost;
}

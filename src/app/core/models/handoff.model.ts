/** HumanHandoff.Status. */
export enum HandoffStatus {
  Pending = 'Pending',
  Assigned = 'Assigned',
  InProgress = 'InProgress',
  Resolved = 'Resolved',
}

/**
 * HumanHandoff.TriggerReason — why the conversation entered the queue.
 *
 * RuleTriggered and CustomerRequested come from the webhook processor; the rest are raised by the
 * AI orchestrator once it has actually attempted a turn. HotLead/KnowledgeGap/BusinessRule are the
 * Phase 7 additions: a customer ready to buy, a question the knowledge base could not ground, and a
 * tenant rule that says a human must take this one.
 *
 * ComplexTechnical stays because handoffs raised before Phase 7 still carry it — the server no
 * longer produces it for new ones, having moved support-flavoured intents onto Support.
 */
export enum HandoffTriggerReason {
  CustomerRequested = 'CustomerRequested',
  LowConfidence = 'LowConfidence',
  CannotAnswer = 'CannotAnswer',
  Complaint = 'Complaint',
  Negotiation = 'Negotiation',
  ComplexTechnical = 'ComplexTechnical',
  RuleTriggered = 'RuleTriggered',
  HotLead = 'HotLead',
  KnowledgeGap = 'KnowledgeGap',
  BusinessRule = 'BusinessRule',
}

/** One answer the customer has given. `enteredByHuman` separates what a colleague typed from what
 * the AI extracted — worth knowing before acting on it. */
export interface HandoffQualificationItem {
  displayName: string;
  rawValue: string;
  enteredByHuman: boolean;
  capturedAt: string;
}

/** One contribution to the lead score, already stripped of its storage prefix by the server. */
export interface HandoffScoreLine {
  label: string;
  points: number;
}

/**
 * HandoffSummary — the briefing assembled when the handoff was raised.
 *
 * A snapshot, not a live view: the lead keeps changing after the escalation, and a summary
 * regenerated on open would quietly describe a different situation than the one that caused it.
 * Read it as "what was true when the AI stepped back".
 */
export interface HandoffSummary {
  customerName: string;
  customerPhoneNumberE164: string;
  requirement: string | null;
  qualification: HandoffQualificationItem[];
  /** Configured questions still unanswered, in the order the agent would have asked them. */
  stillUnknown: string[];
  scoreNumeric: number;
  /** Hot / Warm / Cold. */
  temperature: string;
  isHot: boolean;
  hotReason: string | null;
  scoreBreakdown: HandoffScoreLine[];
  detectedIntent: string | null;
  triggerReason: string;
  agentNote: string | null;
  /** Set only when validation is what stopped the reply, so a suppressed reply can be explained. */
  blockedReason: string | null;
  lastCustomerMessage: string | null;
  messageCount: number;
  conversationStartedAt: string;
  escalatedAt: string;
}

/** HandoffDto. Conversation/customer details arrive denormalized, same as ConversationDto. */
export interface Handoff {
  id: string;
  conversationId: string;
  customerId: string;
  customerPhoneNumberE164: string;
  customerName: string;
  triggerReason: HandoffTriggerReason | string;
  status: HandoffStatus | string;
  assignedAgentId: string | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
  /** Null for a handoff raised before briefings existed, or by a path that does not build one
   * (the webhook processor's "no AI attempted this" handoff). */
  summary: HandoffSummary | null;
}

export interface ResolveHandoffRequest {
  notes?: string | null;
}

export function handoffStatusChipClass(status: string): string {
  switch (status) {
    case HandoffStatus.Pending:
      return 'status-chip status-chip--paused';
    case HandoffStatus.Assigned:
      return 'status-chip status-chip--scheduled';
    case HandoffStatus.InProgress:
      return 'status-chip status-chip--running';
    case HandoffStatus.Resolved:
      return 'status-chip status-chip--completed';
    default:
      return 'status-chip status-chip--draft';
  }
}

/** Hot/Warm/Cold reuse the campaign palette rather than getting three more classes of their own. */
export function leadTemperatureChipClass(temperature: string): string {
  switch (temperature) {
    case 'Hot':
      return 'status-chip status-chip--stopped';
    case 'Warm':
      return 'status-chip status-chip--paused';
    case 'Cold':
      return 'status-chip status-chip--scheduled';
    default:
      return 'status-chip status-chip--draft';
  }
}

/** PascalCase enum name -> something readable in a queue an agent scans all day. */
export function handoffTriggerReasonLabel(reason: string): string {
  switch (reason) {
    case HandoffTriggerReason.CustomerRequested:
      return 'Customer asked for a person';
    case HandoffTriggerReason.LowConfidence:
      return 'AI unsure';
    case HandoffTriggerReason.CannotAnswer:
      return 'AI could not answer';
    case HandoffTriggerReason.Complaint:
      return 'Complaint';
    case HandoffTriggerReason.Negotiation:
      return 'Negotiation';
    case HandoffTriggerReason.ComplexTechnical:
      return 'Technical question';
    case HandoffTriggerReason.RuleTriggered:
      return 'Rule';
    case HandoffTriggerReason.HotLead:
      return 'Hot lead';
    case HandoffTriggerReason.KnowledgeGap:
      return 'Knowledge gap';
    case HandoffTriggerReason.BusinessRule:
      return 'Business rule';
    default:
      // A reason this build does not know about is shown as sent rather than hidden — an unfamiliar
      // label is a smaller problem than a blank one.
      return reason;
  }
}

/** Mirrors HandoffService.ClaimAsync's remarks: re-claiming an already-Assigned handoff
 * reassigns it rather than failing, so Claim is offered for anything not yet Resolved. */
export function canClaimHandoff(status: string): boolean {
  return status !== HandoffStatus.Resolved;
}

export function canResolveHandoff(status: string): boolean {
  return status !== HandoffStatus.Resolved;
}

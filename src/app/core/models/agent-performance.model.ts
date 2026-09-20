/** AgentTurnStatsDto. */
export interface AgentTurnStats {
  totalTurns: number;
  repliedTurns: number;
  escalatedTurns: number;
  /** Replied / total. Not a number to maximise — an agent that never escalates is one that answers
   * questions it should have handed over. */
  containmentRate: number;
  averageConfidence: number;
  /** Turns where a blocking check stopped the reply. Distinct from escalations. */
  blockedReplies: number;
  averageLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

/** QualificationFieldStatsDto. `askEffectiveness` is the one to read first: a field asked in 80
 * conversations and answered in 12 is a badly phrased question, not a stubborn customer. */
export interface QualificationFieldStats {
  fieldKey: string;
  displayName: string;
  isRequired: boolean;
  isActive: boolean;
  timesAsked: number;
  conversationsAsked: number;
  /** Includes values the customer volunteered, which is why it can exceed `conversationsAsked`. */
  conversationsCaptured: number;
  conversationsCapturedAfterAsk: number;
  askEffectiveness: number;
  /** Null when the field was never captured after an ask. */
  averageTurnsToCapture: number | null;
}

/** ValidationFailureStatsDto. The code names where to look, not who to blame — a spike in
 * UngroundedNumber usually means the knowledge base is missing something customers keep asking. */
export interface ValidationFailureStats {
  code: string;
  blocking: boolean;
  occurrences: number;
  affectedConversations: number;
  shareOfTurns: number;
}

/** LeadOutcomeStatsDto. Hot conversion against everyone else is the test of the scoring rules. */
export interface LeadOutcomeStats {
  totalLeads: number;
  hot: number;
  warm: number;
  cold: number;
  /** Leads the hot-lead rules fired on — not the same as leads currently in the hot band, since the
   * stamp is permanent and the band is current state. */
  hotLeadsDetected: number;
  hotLeadsWon: number;
  hotConversionRate: number;
  otherLeadsWon: number;
  otherConversionRate: number;
}

export interface AgentPerformanceReport {
  fromUtc: string;
  toUtc: string;
  turns: AgentTurnStats;
  fields: QualificationFieldStats[];
  validationFailures: ValidationFailureStats[];
  leads: LeadOutcomeStats;
}

/** Windows the API accepts. It clamps at 90 days, so nothing longer is offered. */
export const AGENT_PERFORMANCE_WINDOWS: { label: string; days: number }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

/**
 * What each output check means, in the terms of the thing that usually causes it.
 *
 * Deliberately not a restatement of the check's name. "UngroundedNumber" tells an admin nothing they
 * cannot read off the code; "the agent stated a number nothing supports — usually a price the
 * knowledge base does not have" tells them where to go.
 */
export function validationCodeMeaning(code: string): string {
  switch (code) {
    case 'UngroundedNumber':
      return 'Stated a number nothing supports — usually a price or size the knowledge base is missing.';
    case 'InternalTermLeak':
      return 'Described its own machinery to the customer.';
    case 'ScoreDisclosure':
      return 'Mentioned how the customer is scored, which this business has not allowed.';
    case 'ResponseTooLong':
      return 'Wrote a reply too long for WhatsApp.';
    case 'EmptyResponse':
      return 'Returned no reply at all.';
    case 'UnknownIntent':
      return 'Reported an intent this system does not recognise.';
    case 'UnknownField':
      return 'Claimed a value for a question that is not in your schema.';
    case 'UnofferedField':
      return 'Said it asked something that was not on the list it was given.';
    case 'HallucinatedCitation':
      return 'Cited a knowledge base passage it was never shown.';
    default:
      // A code this build does not know about is still worth showing with its count.
      return '';
  }
}

/** Ask effectiveness, coloured the way a reviewer would triage it: anything under a third is the
 * question's fault far more often than the customer's. */
export function askEffectivenessClass(rate: number, conversationsAsked: number): string {
  if (conversationsAsked === 0) {
    return 'status-chip status-chip--draft';
  }
  if (rate >= 0.6) {
    return 'status-chip status-chip--opted-in';
  }
  if (rate >= 0.33) {
    return 'status-chip status-chip--pending';
  }
  return 'status-chip status-chip--opted-out';
}

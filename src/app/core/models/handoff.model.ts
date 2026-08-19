/** HumanHandoff.Status. */
export enum HandoffStatus {
  Pending = 'Pending',
  Assigned = 'Assigned',
  InProgress = 'InProgress',
  Resolved = 'Resolved',
}

/**
 * HumanHandoff.TriggerReason. LowConfidence/CannotAnswer/Complaint/Negotiation/ComplexTechnical
 * are Phase 5 values — there is no AI service yet to produce a confidence score or judge
 * complexity, so Phase 4 only ever raises RuleTriggered (every inbound message, since there is
 * no AI to attempt a reply first) or CustomerRequested. Kept complete here so the UI does not
 * need updating the day Phase 5 starts using the rest.
 */
export enum HandoffTriggerReason {
  CustomerRequested = 'CustomerRequested',
  LowConfidence = 'LowConfidence',
  CannotAnswer = 'CannotAnswer',
  Complaint = 'Complaint',
  Negotiation = 'Negotiation',
  ComplexTechnical = 'ComplexTechnical',
  RuleTriggered = 'RuleTriggered',
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

/** Mirrors HandoffService.ClaimAsync's remarks: re-claiming an already-Assigned handoff
 * reassigns it rather than failing, so Claim is offered for anything not yet Resolved. */
export function canClaimHandoff(status: string): boolean {
  return status !== HandoffStatus.Resolved;
}

export function canResolveHandoff(status: string): boolean {
  return status !== HandoffStatus.Resolved;
}

/** Conversation.Mode. No IAiService exists until Phase 5 — every inbound message escalates to a
 * human regardless of Mode today (see InboundWebhookProcessor on the backend); Mode is recorded
 * for forward-compatibility, not yet acted on differently per value. */
export enum ConversationMode {
  AI = 'AI',
  Human = 'Human',
  Hybrid = 'Hybrid',
}

/** Conversation.Status. */
export enum ConversationStatus {
  Open = 'Open',
  Escalated = 'Escalated',
  Closed = 'Closed',
}

/** Message.Direction. */
export enum MessageDirection {
  Outbound = 'Outbound',
  Inbound = 'Inbound',
}

/** Message.Status. Delivered/Read only ever arrive via WhatsApp status webhooks. */
export enum MessageStatus {
  Queued = 'Queued',
  Sent = 'Sent',
  Delivered = 'Delivered',
  Read = 'Read',
  Failed = 'Failed',
}

/** ConversationDto. Customer phone/name arrive denormalized — no separate Customer lookup
 * needed to render the inbox list. */
export interface Conversation {
  id: string;
  customerId: string;
  customerPhoneNumberE164: string;
  customerName: string;
  mode: ConversationMode | string;
  status: ConversationStatus | string;
  assignedAgentId: string | null;
  /** Most recent message in either direction — drives inbox sort order. */
  lastMessageAt: string | null;
  /** Most recent *inbound* message specifically — see canSendFreeText for why this, not
   * lastMessageAt, is what the customer service window is measured from. */
  lastInboundMessageAt: string | null;
  createdAt: string;
  closedAt: string | null;
}

/** ConversationMessageDto — one row of a conversation's transcript. */
export interface ConversationMessage {
  id: string;
  direction: MessageDirection | string;
  messageType: string;
  text: string | null;
  templateName: string | null;
  status: MessageStatus | string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ChangeConversationModeRequest {
  mode: string;
}

export interface AssignConversationRequest {
  agentId: string;
}

/**
 * SendConversationMessageRequest. Exactly one of text/messageTemplateId — the backend 400s
 * otherwise. Free text only within the customer service window (see canSendFreeText); a
 * template works at any time.
 */
export interface SendConversationMessageRequest {
  text?: string | null;
  messageTemplateId?: string | null;
}

/** MessagingOptions.CustomerServiceWindowHours' default — there is no endpoint exposing the
 * server's actual configured value, so this is a UI hint only (whether to offer free text at
 * all); the backend is the real authority and 409s regardless if this guess is stale. */
export const DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS = 24;

export function conversationStatusChipClass(status: string): string {
  switch (status) {
    case ConversationStatus.Open:
      return 'status-chip status-chip--running';
    case ConversationStatus.Escalated:
      return 'status-chip status-chip--paused';
    case ConversationStatus.Closed:
      return 'status-chip status-chip--stopped';
    default:
      return 'status-chip status-chip--draft';
  }
}

/** A closed conversation cannot be replied to, assigned or re-moded — it is history. */
export function canActOnConversation(status: string): boolean {
  return status !== ConversationStatus.Closed;
}

/**
 * Mirrors IConversationService.SendMessageAsync's free-text rule: WhatsApp only allows a
 * business to send free-form text within `windowHours` (Meta's real rule is 24) of the
 * customer's last inbound message — MessagingOptions.CustomerServiceWindowHours on the
 * backend, passed in here rather than hardcoded since it's server-configurable. Outside the
 * window an Approved template is required instead; that path has no time restriction, so
 * there is no equivalent canSendTemplate guard. This is a client-side hint only — the
 * backend re-validates and 400s regardless, naming how many hours ago the window closed.
 */
export function canSendFreeText(lastInboundMessageAt: string | null, windowHours: number, now: Date = new Date()): boolean {
  if (!lastInboundMessageAt) {
    return false;
  }
  const elapsedHours = (now.getTime() - new Date(lastInboundMessageAt).getTime()) / (1000 * 60 * 60);
  return elapsedHours <= windowHours;
}

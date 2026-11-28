/** Tenant Conversations (Platform Admin Console): WhatsApp chats between the platform's own number and tenants. Timestamps are UTC
 * (sent without a "Z") - always show them through the zonedDate pipe. */

export type PlatformConversationDirection = 'Outbound' | 'Inbound';
export type PlatformConversationMessageStatus =
  | 'Queued'
  | 'Sent'
  | 'Delivered'
  | 'Read'
  | 'Failed';

export interface PlatformConversation {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  phoneE164: string;
  contactName: string | null;
  lastMessageAtUtc: string | null;
  lastInboundAtUtc: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  /** Free text can be sent: the tenant wrote within the last 24 hours. */
  windowOpen: boolean;
  windowClosesAtUtc: string | null;
}

export interface PlatformConversationMessage {
  id: string;
  direction: PlatformConversationDirection;
  body: string | null;
  messageType: string;
  templateName: string | null;
  status: PlatformConversationMessageStatus;
  errorMessage: string | null;
  sentByEmail: string | null;
  sentAtUtc: string;
}

export interface PlatformConversationDetail {
  conversation: PlatformConversation;
  /** Oldest first. */
  messages: PlatformConversationMessage[];
  hasOlder: boolean;
}

export interface PlatformTenantPhone {
  label: string;
  phoneE164: string;
}

export interface PlatformConversationContact {
  tenantId: string;
  tenantName: string;
  phones: PlatformTenantPhone[];
  conversationId: string | null;
}

export interface PlatformConversationTemplate {
  id: string;
  name: string;
  whatsAppTemplateName: string;
  language: string;
  bodyText: string;
  usesTitle: boolean;
  usesMessage: boolean;
  /** The "Message from the AiSaarthi team" template made for this page. */
  isDefault: boolean;
}

export interface StartPlatformConversationRequest {
  tenantId: string | null;
  phone: string | null;
}

/** Either text, or templateId with title/message for its values. */
export interface SendPlatformConversationMessageRequest {
  text: string | null;
  templateId: string | null;
  title: string | null;
  message: string | null;
}

/** How to get the tenant to write first (so free text works without a template): a wa.me link to the platform number and the tenant's email. */
export interface PlatformConversationInvite {
  platformNumber: string | null;
  whatsAppLink: string | null;
  email: string | null;
  /** Where the email came from: "Billing alerts", "Owner" or "Support". */
  emailSource: string | null;
  prefilledText: string;
}

export enum TemplateCategory {
  Marketing = 'Marketing',
  Utility = 'Utility',
  Authentication = 'Authentication',
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  TemplateCategory.Marketing,
  TemplateCategory.Utility,
  TemplateCategory.Authentication,
];

export enum WhatsAppTemplateStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

/** MessageTemplateDto. */
export interface MessageTemplate {
  id: string;
  name: string;
  language: string;
  category: TemplateCategory | string;
  whatsAppTemplateName: string;
  whatsAppTemplateStatus: WhatsAppTemplateStatus | string;
  bodyText: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateMessageTemplateRequest {
  name: string;
  language: string;
  category: string;
  whatsAppTemplateName: string;
  bodyText: string;
}

/**
 * UpdateMessageTemplateRequest. Only body text and active flag are editable — name, language,
 * category and the Meta-registered template name are fixed after creation. Editing the body
 * text of an Approved template silently reverts it to Pending server-side (a content change
 * that stayed Approved would let an unreviewed message go out under an approved name).
 */
export interface UpdateMessageTemplateRequest {
  bodyText: string;
  isActive: boolean;
}

export interface ReviewMessageTemplateRequest {
  status: string;
}

export function templateStatusChipClass(status: string): string {
  switch (status) {
    case WhatsAppTemplateStatus.Approved:
      return 'status-chip status-chip--opted-in';
    case WhatsAppTemplateStatus.Rejected:
      return 'status-chip status-chip--opted-out';
    default:
      return 'status-chip status-chip--pending';
  }
}

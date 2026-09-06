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
  /**
   * Meta's id for this template once it has been pushed there, else null. whatsAppTemplateStatus
   * alone can't distinguish "never synced" from "pushed and genuinely Pending on Meta" — both show
   * Pending — so the Meta status column must check this field directly rather than the status text.
   */
  metaTemplateId: string | null;
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

/** Response of POST /message-templates/{id}/sync — the per-row Sync button. */
export interface MessageTemplateSyncOneResult {
  template: MessageTemplate;
  /** Set only if this template's own push to Meta failed (e.g. Meta rejected it); the template's
   *  status/metaTemplateId still reflect whatever the pull phase found regardless. */
  pushError: string | null;
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

/** Meta sync status column — distinct from templateStatusChipClass because a never-pushed template
 *  (metaTemplateId null) must not be shown the same as a genuinely Pending-on-Meta template. */
export function metaStatusLabel(template: MessageTemplate): string {
  return template.metaTemplateId ? template.whatsAppTemplateStatus : 'Not synced';
}

export function metaStatusChipClass(template: MessageTemplate): string {
  return template.metaTemplateId ? templateStatusChipClass(template.whatsAppTemplateStatus) : 'status-chip status-chip--inactive';
}

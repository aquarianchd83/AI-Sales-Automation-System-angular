import { PagedQuery } from './paged-result.model';

/** AuditLogEntryDto (verified against /swagger/v1/swagger.json). Written by the data layer in the
 * same transaction as the change it describes, so there is nothing to create or edit from the UI. */
export interface AuditLogEntry {
  id: string;
  entityName: string | null;
  entityId: string;
  action: string | null;
  /** A JSON document describing what changed; the shape depends on the entity. */
  changesJson: string | null;
  performedBy: string | null;
  performedByName: string | null;
  /** Set when a platform operator made the change while impersonating this tenant's user. */
  impersonatedBy: string | null;
  performedAt: string;
  ipAddress: string | null;
}

/** AuditLogQuery. Combine `entityName` and `entityId` for the history of one record. */
export interface AuditLogQuery extends PagedQuery {
  entityName?: string;
  entityId?: string;
  action?: string;
  performedBy?: string;
  /** ISO date-time, inclusive. */
  from?: string;
  /** ISO date-time, inclusive. */
  to?: string;
}

/** Pretty-prints `changesJson`, or returns the raw text when it is not valid JSON. */
export function formatChanges(changesJson: string | null): string {
  if (!changesJson) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(changesJson), null, 2);
  } catch {
    return changesJson;
  }
}

/** The kinds of record the trail covers, as the API names them. Drives the Record type filter. */
export const AUDIT_RECORD_TYPES: { value: string; label: string }[] = [
  { value: 'User', label: 'Users and sign-ins' },
  { value: 'WhatsAppConfig', label: 'WhatsApp connection' },
  { value: 'AiProviderConfig', label: 'AI provider' },
  { value: 'MessageTemplate', label: 'Message templates' },
  { value: 'QualificationField', label: 'Qualification fields' },
  { value: 'ScoringRule', label: 'Scoring rules' },
  { value: 'Lead', label: 'Leads' },
  { value: 'Campaign', label: 'Campaigns' },
  { value: 'Conversation', label: 'Conversations' },
  { value: 'Handoff', label: 'Handoffs' },
  { value: 'Customer', label: 'Customer opt-in' },
  { value: 'KnowledgeArticle', label: 'Knowledge articles' },
];

type Change = { from?: unknown; to?: unknown };

/**
 * One plain sentence for what an entry says happened, for the kinds of change people look the trail up for - a wrong password, a lockout, a
 * changed credential, a new set of roles. Null when there is nothing better to say than the raw changes. Never shows a secret: the API
 * only ever sends "changed" for those.
 */
export function describeAuditEntry(entry: Pick<AuditLogEntry, 'entityName' | 'action' | 'changesJson'>): string | null {
  if (!entry.changesJson) {
    return null;
  }
  let changes: Record<string, unknown>;
  try {
    changes = JSON.parse(entry.changesJson) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!changes || typeof changes !== 'object') {
    return null;
  }

  const change = (key: string): Change | undefined => {
    const value = changes[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Change) : undefined;
  };
  const parts: string[] = [];

  if (entry.entityName === 'User') {
    if (entry.action === 'Create') {
      return 'User created';
    }
    const failed = change('AccessFailedCount');
    const lock = change('LockoutEnd');
    const active = change('IsActive');
    const roles = change('Roles');

    if (lock && lock.to) {
      parts.push(`Locked out until ${new Date(String(lock.to)).toLocaleString()}`);
    } else if (lock) {
      parts.push('Lockout lifted');
    }
    if (failed && Number(failed.to) > Number(failed.from ?? 0)) {
      parts.push(`Wrong password (attempt ${failed.to})`);
    } else if (failed && Number(failed.to) === 0 && !lock) {
      parts.push('Failed attempts cleared');
    }
    if (changes['PasswordHash'] === 'changed') {
      parts.push('Password changed');
    }
    if (active) {
      parts.push(active.to === false ? 'Deactivated' : 'Reactivated');
    }
    if (roles) {
      const list = (value: unknown) => (Array.isArray(value) && value.length ? value.join(', ') : 'none');
      parts.push(`Roles: ${list(roles.from)} → ${list(roles.to)}`);
    }
    if (change('EmailConfirmed')?.to === true) {
      parts.push('Email confirmed');
    }
    if (change('PhoneNumberConfirmed')?.to === true) {
      parts.push('Phone verified');
    }
    return parts.length ? parts.join('; ') : null;
  }

  if (entry.entityName === 'WhatsAppConfig' || entry.entityName === 'AiProviderConfig') {
    const secrets = Object.keys(changes).filter((key) => changes[key] === 'changed');
    if (secrets.length) {
      parts.push(`Credentials changed (${secrets.join(', ')})`);
    }
    return parts.length ? parts.join('; ') : null;
  }

  return null;
}

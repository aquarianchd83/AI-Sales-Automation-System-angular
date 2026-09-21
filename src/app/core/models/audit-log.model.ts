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

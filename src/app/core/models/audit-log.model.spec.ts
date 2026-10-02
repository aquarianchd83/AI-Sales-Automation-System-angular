import { AUDIT_RECORD_TYPES, describeAuditEntry } from './audit-log.model';

describe('describeAuditEntry', () => {
  const entry = (entityName: string, action: string, changes: unknown) => ({ entityName, action, changesJson: JSON.stringify(changes) });

  it('says a wrong password was typed, and which attempt it was', () => {
    expect(describeAuditEntry(entry('User', 'Update', { AccessFailedCount: { from: 2, to: 3 } }))).toBe('Wrong password (attempt 3)');
  });

  it('says when someone was locked out, and when it was lifted', () => {
    const locked = describeAuditEntry(entry('User', 'Update', { AccessFailedCount: { from: 4, to: 5 }, LockoutEnd: { from: null, to: '2026-10-02T12:15:00Z' } }));
    expect(locked).toContain('Locked out until');
    expect(locked).toContain('Wrong password (attempt 5)');
    expect(describeAuditEntry(entry('User', 'Update', { LockoutEnd: { from: '2026-10-02T12:15:00Z', to: null }, AccessFailedCount: { from: 5, to: 0 } }))).toBe('Lockout lifted');
  });

  it('says a password changed without showing anything of it', () => {
    expect(describeAuditEntry(entry('User', 'Update', { PasswordHash: 'changed' }))).toBe('Password changed');
  });

  it('says a user was deactivated or reactivated', () => {
    expect(describeAuditEntry(entry('User', 'StatusChange', { IsActive: { from: true, to: false } }))).toBe('Deactivated');
    expect(describeAuditEntry(entry('User', 'StatusChange', { IsActive: { from: false, to: true } }))).toBe('Reactivated');
  });

  it('shows a change of roles as before and after', () => {
    expect(describeAuditEntry(entry('User', 'Update', { Roles: { from: ['SalesAgent'], to: ['Admin', 'SalesManager'] } }))).toBe('Roles: SalesAgent → Admin, SalesManager');
    expect(describeAuditEntry(entry('User', 'Update', { Roles: { from: [], to: ['Admin'] } }))).toBe('Roles: none → Admin');
  });

  it('says a new user was created, and that an email or phone was confirmed', () => {
    expect(describeAuditEntry(entry('User', 'Create', { FullName: 'Asha' }))).toBe('User created');
    expect(describeAuditEntry(entry('User', 'Update', { EmailConfirmed: { from: false, to: true } }))).toBe('Email confirmed');
    expect(describeAuditEntry(entry('User', 'Update', { PhoneNumberConfirmed: { from: false, to: true } }))).toBe('Phone verified');
  });

  it('names the credentials that changed and never a value', () => {
    const text = describeAuditEntry(entry('WhatsAppConfig', 'Update', { AccessToken: 'changed', PhoneNumberId: { from: '1', to: '2' } }));
    expect(text).toBe('Credentials changed (AccessToken)');
    expect(describeAuditEntry(entry('AiProviderConfig', 'Update', { OpenAiApiKey: 'changed' }))).toBe('Credentials changed (OpenAiApiKey)');
  });

  it('has nothing to add for other records, empty changes, or text that is not JSON', () => {
    expect(describeAuditEntry(entry('Lead', 'StatusChange', { Stage: { from: 'New', to: 'Won' } }))).toBeNull();
    expect(describeAuditEntry({ entityName: 'User', action: 'Update', changesJson: null })).toBeNull();
    expect(describeAuditEntry({ entityName: 'User', action: 'Update', changesJson: 'not json' })).toBeNull();
    expect(describeAuditEntry(entry('User', 'Update', {}))).toBeNull();
  });
});

describe('AUDIT_RECORD_TYPES', () => {
  it('lists the new record types alongside the old, each once', () => {
    const values = AUDIT_RECORD_TYPES.map((type) => type.value);

    expect(values).toEqual(jasmine.arrayContaining(['User', 'WhatsAppConfig', 'AiProviderConfig', 'MessageTemplate', 'QualificationField', 'ScoringRule', 'Lead', 'Campaign', 'Conversation', 'Handoff', 'Customer', 'KnowledgeArticle']));
    expect(new Set(values).size).toBe(values.length);
  });
});

import { LeadDiscoveryExecutionCustomer, filterByVerification, leadDiscoveryStatusChipClass, rowHistoryEvents, verificationChipClass, verificationLabel } from './lead-discovery-history.model';

describe('leadDiscoveryStatusChipClass', () => {
  it('greens a settled success across execution, campaign and lock vocabularies', () => {
    expect(leadDiscoveryStatusChipClass('Completed')).toBe('status-chip status-chip--completed');
    expect(leadDiscoveryStatusChipClass('Created')).toBe('status-chip status-chip--completed');
    expect(leadDiscoveryStatusChipClass('Released')).toBe('status-chip status-chip--completed');
  });

  it('reds a settled failure', () => {
    expect(leadDiscoveryStatusChipClass('Failed')).toBe('status-chip status-chip--opted-out');
    expect(leadDiscoveryStatusChipClass('Blocked')).toBe('status-chip status-chip--opted-out');
    expect(leadDiscoveryStatusChipClass('Expired')).toBe('status-chip status-chip--opted-out');
    expect(leadDiscoveryStatusChipClass('Lost')).toBe('status-chip status-chip--opted-out');
  });

  it('ambers anything waiting on a retry', () => {
    expect(leadDiscoveryStatusChipClass('RetryPending')).toBe('status-chip status-chip--pending');
    expect(leadDiscoveryStatusChipClass('PartiallyCompleted')).toBe('status-chip status-chip--pending');
  });

  it('blues work in progress', () => {
    expect(leadDiscoveryStatusChipClass('Processing')).toBe('status-chip status-chip--scheduled');
    expect(leadDiscoveryStatusChipClass('Acquired')).toBe('status-chip status-chip--scheduled');
  });

  it('defaults to a neutral tone for Pending/Skipped/unknown values', () => {
    expect(leadDiscoveryStatusChipClass('Pending')).toBe('status-chip status-chip--inactive');
    expect(leadDiscoveryStatusChipClass('Skipped')).toBe('status-chip status-chip--inactive');
    expect(leadDiscoveryStatusChipClass('Anything else')).toBe('status-chip status-chip--inactive');
  });
});

describe('verification display', () => {
  it('words a rejected number and an unchecked one differently', () => {
    expect(verificationLabel('Fail')).toBe('Failed');
    expect(verificationLabel('Error')).toBe('Check error');
    expect(verificationLabel('Pass')).toBe('Passed');
    expect(verificationLabel('NotChecked')).toBe('—');
  });

  it('colours Pass green, Fail red and Error amber', () => {
    expect(verificationChipClass('Pass')).toContain('completed');
    expect(verificationChipClass('Fail')).toContain('opted-out');
    expect(verificationChipClass('Error')).toContain('pending');
    expect(verificationChipClass('NotChecked')).toContain('inactive');
  });
});

describe('rowHistoryEvents', () => {
  const row = (over: Partial<LeadDiscoveryExecutionCustomer>): LeadDiscoveryExecutionCustomer => ({
    id: 'r1', customerId: null, discoveredLeadId: null, customerName: 'Eye clinic 1', phone: '+919800000001', status: 'Skipped',
    isInvalid: true, errorMessage: null, errorDetails: null, retriedFromId: null, processedAtUtc: '2026-10-15T06:00:00Z',
    verificationStatus: 'NotChecked', verificationReasonCode: null, verificationReason: null, verifiedAtUtc: null, ...over,
  });

  it('records a rejected number: discovered, submitted, failed with the reason, and no customer created', () => {
    const events = rowHistoryEvents(row({
      verificationStatus: 'Fail', verificationReasonCode: 'DND', verificationReason: 'On the DND list',
      verifiedAtUtc: '2026-10-15T06:00:01Z', errorMessage: 'Rejected by the DND check - no customer created.',
    }));

    expect(events.map((e) => e.eventType)).toEqual(['Discovered', 'VerificationSubmitted', 'VerificationFailed', 'CustomerNotCreated']);
    expect(events[2].reason).toBe('On the DND list');
    expect(events[3].reason).toContain('no customer created');
  });

  it('starts with Customer discovered and never dates an entry later than the one below it', () => {
    const events = rowHistoryEvents(row({
      verificationStatus: 'Fail', verifiedAtUtc: '2026-10-15T06:00:00Z', processedAtUtc: '2026-10-15T06:00:01Z', errorMessage: 'Rejected',
    }));

    expect(events[0].eventType).toBe('Discovered');
    const times = events.map((e) => new Date(e.occurredAtUtc).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('records an invalid business with its reason and no verification', () => {
    const events = rowHistoryEvents(row({ errorMessage: 'Invalid: closed business' }));

    expect(events.map((e) => e.eventType)).toEqual(['Discovered', 'CustomerNotCreated']);
    expect(events[1].reason).toBe('Invalid: closed business');
  });
});

describe('filterByVerification', () => {
  const row = (id: string, verificationStatus: string): LeadDiscoveryExecutionCustomer =>
    ({ id, verificationStatus } as LeadDiscoveryExecutionCustomer);
  const rows = [row('a', 'Pass'), row('b', 'Fail'), row('c', 'Error'), row('d', 'Pass')];

  it('keeps every row for All', () => {
    expect(filterByVerification(rows, 'All').length).toBe(4);
  });

  it('keeps only rows with the chosen status', () => {
    expect(filterByVerification(rows, 'Pass').map((r) => r.id)).toEqual(['a', 'd']);
    expect(filterByVerification(rows, 'Fail').map((r) => r.id)).toEqual(['b']);
    expect(filterByVerification(rows, 'Pending')).toEqual([]);
  });
});

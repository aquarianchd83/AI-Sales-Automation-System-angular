import { leadDiscoveryStatusChipClass } from './lead-discovery-history.model';

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

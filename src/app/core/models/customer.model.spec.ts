import { customerHistoryEventLabel, optInStatusChipClass, optInStatusLabel } from './customer.model';

describe('opt-in status display', () => {
  it('words each status', () => {
    expect(optInStatusLabel('OptedIn')).toBe('Opted in');
    expect(optInStatusLabel('OptedOut')).toBe('Opted out');
    expect(optInStatusLabel('WaitingForConsent')).toBe('Waiting for consent');
    expect(optInStatusLabel('PendingOptIn')).toBe('Pending opt-in');
    expect(optInStatusLabel(undefined)).toBe('—');
  });

  it('colours opted in green, opted out red and the rest amber', () => {
    expect(optInStatusChipClass('OptedIn')).toContain('opted-in');
    expect(optInStatusChipClass('OptedOut')).toContain('opted-out');
    expect(optInStatusChipClass('WaitingForConsent')).toContain('pending');
    expect(optInStatusChipClass('PendingOptIn')).toContain('pending');
  });
});

describe('customerHistoryEventLabel', () => {
  it('words the discovery and verification events', () => {
    expect(customerHistoryEventLabel('Discovered')).toBe('Customer discovered');
    expect(customerHistoryEventLabel('VerificationSubmitted')).toBe('Submitted for verification');
    expect(customerHistoryEventLabel('VerificationPassed')).toBe('Verification passed');
    expect(customerHistoryEventLabel('VerificationFailed')).toBe('Verification failed');
    expect(customerHistoryEventLabel('SmsDelivered')).toBe('Consent SMS delivered');
    expect(customerHistoryEventLabel('ConversationStarted')).toBe('Customer started a WhatsApp conversation');
    expect(customerHistoryEventLabel('ConsentRecorded')).toBe('WhatsApp opt-in recorded');
    expect(customerHistoryEventLabel('WaitingForContent')).toBe('Waiting for content');
    expect(customerHistoryEventLabel('FirstMessageSent')).toBe('First campaign message sent');
    expect(customerHistoryEventLabel('SomethingNew')).toBe('Something New');   // unknown kinds are split into words, not shown raw
    expect(customerHistoryEventLabel('Odd')).toBe('Odd');
  });
});

import { DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS, canActOnConversation, canSendFreeText, ConversationStatus } from './conversation.model';

/**
 * Mirrors IConversationService.SendMessageAsync's free-text window check:
 * `lastInbound.AddHours(windowHours) >= now`. Pinned so a change to that formula on the
 * backend shows up here, not as a silent 409 behind a composer that still offered "Text".
 */
describe('canSendFreeText', () => {
  it('is false when the customer has never messaged in', () => {
    expect(canSendFreeText(null, DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS)).toBeFalse();
  });

  it('is true right at the last inbound message', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    expect(canSendFreeText('2026-01-02T00:00:00Z', 24, now)).toBeTrue();
  });

  it('is true exactly at the window boundary and false just past it', () => {
    const lastInbound = '2026-01-01T00:00:00Z';
    const atBoundary = new Date('2026-01-02T00:00:00Z'); // exactly 24h later
    const pastBoundary = new Date('2026-01-02T00:00:01Z'); // 24h + 1s later
    expect(canSendFreeText(lastInbound, 24, atBoundary)).toBeTrue();
    expect(canSendFreeText(lastInbound, 24, pastBoundary)).toBeFalse();
  });

  it('is false once more than windowHours have elapsed', () => {
    const lastInbound = '2026-01-01T00:00:00Z';
    const now = new Date('2026-01-03T00:00:00Z'); // 48h later
    expect(canSendFreeText(lastInbound, 24, now)).toBeFalse();
  });
});

describe('canActOnConversation', () => {
  it('is false only for Closed', () => {
    expect(canActOnConversation(ConversationStatus.Open)).toBeTrue();
    expect(canActOnConversation(ConversationStatus.Escalated)).toBeTrue();
    expect(canActOnConversation(ConversationStatus.Closed)).toBeFalse();
  });
});

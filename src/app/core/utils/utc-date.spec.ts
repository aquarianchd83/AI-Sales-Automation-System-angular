import { parseUtc } from './utc-date';

describe('parseUtc', () => {
  it('reads a timestamp with no zone as UTC', () => {
    expect(parseUtc('2026-10-16T05:19:40').toISOString()).toBe('2026-10-16T05:19:40.000Z');
    expect(parseUtc('2026-10-16T05:19:40.123456').getTime()).toBe(Date.parse('2026-10-16T05:19:40.123Z'));
  });

  it('leaves a timestamp that already carries a zone alone', () => {
    expect(parseUtc('2026-10-16T05:19:40Z').toISOString()).toBe('2026-10-16T05:19:40.000Z');
    expect(parseUtc('2026-10-16T10:49:40+05:30').toISOString()).toBe('2026-10-16T05:19:40.000Z');
  });

  it('leaves a date-only string alone', () => {
    expect(parseUtc('2026-10-16').toISOString()).toBe('2026-10-16T00:00:00.000Z');
  });
});

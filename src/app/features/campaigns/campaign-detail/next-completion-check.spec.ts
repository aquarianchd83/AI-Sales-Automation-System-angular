import { nextCompletionCheck } from './campaign-detail.component';

describe('nextCompletionCheck', () => {
  it('is 06:00 UTC when it is earlier than that', () => {
    expect(nextCompletionCheck(new Date('2026-11-20T03:00:00Z')).toISOString()).toBe('2026-11-20T06:00:00.000Z');
  });

  it('is 18:00 UTC between the two runs', () => {
    expect(nextCompletionCheck(new Date('2026-11-20T09:25:00Z')).toISOString()).toBe('2026-11-20T18:00:00.000Z');
  });

  it('is 06:00 UTC the next day after the evening run', () => {
    expect(nextCompletionCheck(new Date('2026-11-20T19:00:00Z')).toISOString()).toBe('2026-11-21T06:00:00.000Z');
  });

  it('moves on when it is exactly the run time', () => {
    expect(nextCompletionCheck(new Date('2026-11-20T06:00:00Z')).toISOString()).toBe('2026-11-20T18:00:00.000Z');
  });
});

import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { ZonedDatePipe } from './zoned-date.pipe';

describe('ZonedDatePipe', () => {
  function pipeFor(timezone: string | null): ZonedDatePipe {
    return new ZonedDatePipe({ timezone } as UserPreferencesService);
  }

  // 1 Jan 2026 20:30 UTC is already 2 Jan in Kolkata (+05:30) — a date that differs by zone, so the test
  // can't pass by accident on a machine that happens to sit in one of them.
  const utc = '2026-01-01T20:30:00Z';

  it('renders a timestamp in the chosen timezone', () => {
    const rendered = pipeFor('Asia/Kolkata').transform(utc, 'medium');

    expect(rendered).toContain('Jan 2');
    expect(rendered).toContain('2026');
  });

  it('renders the same instant differently in another timezone', () => {
    const kolkata = pipeFor('Asia/Kolkata').transform(utc, 'mediumDate');
    const newYork = pipeFor('America/New_York').transform(utc, 'mediumDate');

    expect(kolkata).toContain('Jan 2');
    expect(newYork).toContain('Jan 1');
  });

  it('keeps milliseconds for the log viewer format', () => {
    expect(pipeFor('UTC').transform('2026-01-01T20:30:05.123Z', 'HH:mm:ss.SSS')).toContain('20:30:05.123');
  });

  it('falls back to the browser zone when no timezone is set, and to the default format when unknown', () => {
    expect(pipeFor(null).transform(utc, 'medium')).toContain('2026');
    expect(pipeFor('UTC').transform(utc, 'not-a-format')).toContain('2026');
  });

  it('renders nothing for an empty or unparseable value rather than "Invalid Date"', () => {
    expect(pipeFor('UTC').transform(null)).toBe('');
    expect(pipeFor('UTC').transform('')).toBe('');
    expect(pipeFor('UTC').transform('not a date')).toBe('');
  });

  it('survives a timezone this browser cannot resolve', () => {
    expect(pipeFor('Mars/Olympus_Mons').transform(utc, 'mediumDate')).toContain('2026');
  });
});

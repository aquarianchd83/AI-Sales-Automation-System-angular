import { Pipe, PipeTransform } from '@angular/core';

import { parseUtc } from '../../core/utils/utc-date';
import { UserPreferencesService } from '../../core/services/user-preferences.service';

/** The formats this app actually uses, mapped to Intl options. Kept to a small set on purpose — a free-form
 * pattern would tempt callers into per-screen date formats. */
const FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  short: { dateStyle: 'short', timeStyle: 'short' },
  medium: { dateStyle: 'medium', timeStyle: 'medium' },
  mediumDate: { dateStyle: 'medium' },
  time: { timeStyle: 'medium' },
  full: { dateStyle: 'full', timeStyle: 'long' },
  fullDate: { dateStyle: 'full' },
  'dd MMM yyyy': { day: '2-digit', month: 'short', year: 'numeric' },
  'dd MMM yyyy, HH:mm': { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false },
  'd MMM, HH:mm:ss': { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
  'HH:mm:ss': { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
  // The two Angular patterns this app already used, keyed by their exact pattern string so a template can
  // switch from `date` to `zonedDate` without changing its argument — and so neither silently degrades to
  // the default. The log viewer's milliseconds matter; the jobs screen's next-run reads as a weekday.
  'HH:mm:ss.SSS': { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hour12: false },
  'EEE, MMM d': { weekday: 'short', month: 'short', day: 'numeric' },
};

/** Patterns that were written day-first ("19 Oct 2026"), kept so whatever locale the browser has. */
const DAY_FIRST = new Set(['dd MMM yyyy', 'dd MMM yyyy, HH:mm', 'd MMM, HH:mm:ss']);

/**
 * Renders a UTC timestamp in the signed-in user's chosen timezone (UserPreferencesService), falling back to
 * the browser's own zone when they haven't chosen one.
 *
 * Why not Angular's `date` pipe: its `timezone` argument takes a UTC offset like "+0530", not an IANA id
 * like "Asia/Kolkata", so it can't follow a zone through its own daylight-saving changes. Intl.DateTimeFormat
 * takes the id and handles that itself.
 *
 * Pure, so it costs nothing on a long table: a change of timezone is applied by the profile screen reloading
 * the app, not by this pipe watching for one.
 */
@Pipe({ name: 'zonedDate' })
export class ZonedDatePipe implements PipeTransform {
  constructor(private readonly preferences: UserPreferencesService) {}

  /** `timezoneOverride` (an IANA id) wins over the user's own preference — for a timestamp that belongs to the
   * tenant, such as its billing notifications, rather than to the person reading it. */
  transform(
    value: string | Date | null | undefined,
    format: keyof typeof FORMATS | string = 'medium',
    timezoneOverride?: string | null
  ): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : parseUtc(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const options = FORMATS[format] ?? FORMATS['medium'];
    const timeZone = timezoneOverride || this.preferences.timezone;

    try {
      return new Intl.DateTimeFormat(DAY_FIRST.has(format) ? 'en-GB' : undefined, timeZone ? { ...options, timeZone } : options).format(date);
    } catch {
      // An id this browser's ICU data doesn't know — show the browser's own zone rather than nothing.
      return new Intl.DateTimeFormat(undefined, options).format(date);
    }
  }
}

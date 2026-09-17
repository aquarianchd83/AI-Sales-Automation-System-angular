import { Injectable } from '@angular/core';

/** localStorage key for the signed-in user's display timezone — a per-browser cache of what the API already
 * knows, so the first render after a reload uses the right zone instead of flashing browser-local times.
 * Same reasoning as the dismissed-announcements key in ShellComponent. */
const TIMEZONE_KEY = 'wsa.displayTimezone';

/**
 * The signed-in user's display preferences. Today that is just their timezone, which ZonedDatePipe renders
 * every timestamp in.
 *
 * Read synchronously rather than as an Observable: a pure pipe reads it once per change-detection pass, and
 * making it a stream would either force an impure pipe (expensive on long tables) or leave already-rendered
 * timestamps stale anyway. Changing the timezone repaints the app by reloading it — see ProfileComponent.
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private cached: string | null = null;

  /** The IANA id to render timestamps in, or null to use the browser's own zone (what the app did before
   * profiles existed, and the right fallback when nothing is stored yet). */
  get timezone(): string | null {
    if (this.cached === null) {
      try {
        this.cached = localStorage.getItem(TIMEZONE_KEY);
      } catch {
        // Private window, or site data blocked — fall back to the browser's zone.
        this.cached = null;
      }
    }
    return this.cached;
  }

  setTimezone(timezone: string | null): void {
    this.cached = timezone;
    try {
      if (timezone) {
        localStorage.setItem(TIMEZONE_KEY, timezone);
      } else {
        localStorage.removeItem(TIMEZONE_KEY);
      }
    } catch {
      // Nothing to do — the in-memory value still applies for this session.
    }
  }

  /** Called on sign-out: the next user on this browser must not inherit the previous one's zone. */
  clear(): void {
    this.setTimezone(null);
  }
}

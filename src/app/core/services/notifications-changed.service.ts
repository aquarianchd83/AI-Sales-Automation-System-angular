import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Tells the shell's bell that notifications were read or deleted somewhere else (the full Notifications screen), so it
 * refreshes at once instead of waiting for its next poll and showing a count that is no longer true.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsChangedService {
  private readonly changed = new Subject<void>();

  readonly changed$ = this.changed.asObservable();

  notify(): void {
    this.changed.next();
  }
}

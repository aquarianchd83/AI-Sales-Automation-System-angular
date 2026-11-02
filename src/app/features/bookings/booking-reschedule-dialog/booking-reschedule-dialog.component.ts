import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { Booking, slotLocal } from '../../../core/models/booking.model';

export interface BookingRescheduleDialogData {
  booking: Booking;
  /** The workspace's own time zone: the times picked here are read in it. */
  timezone: string | null;
  /** Saves the booking as Reschedule with this time ("2026-11-04T11:00"), or none. The dialog stays open if it fails, so the reason can be acted on. */
  save: (newSlotLocal: string | null) => Observable<Booking>;
}

export interface BookingRescheduleResult {
  booking: Booking;
  /** The team wants a message to the customer, ready to send. */
  writeMessage: boolean;
}

/**
 * Marking a booking Reschedule: pick the new date and time (or leave it for later), and say whether to write the customer a message about it. The time is the
 * team's own clock - the workspace's time zone, stated in the dialog - so what is picked here is what the customer is told.
 */
@Component({
  selector: 'app-booking-reschedule-dialog',
  templateUrl: './booking-reschedule-dialog.component.html',
  styles: [
    `
      .intro {
        margin: 0 0 16px;
      }
      .row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .row mat-form-field {
        flex: 1 1 160px;
      }
      .zone,
      .hint {
        font-size: 12px;
        margin: 0 0 12px;
      }
    `,
  ],
})
export class BookingRescheduleDialogComponent {
  readonly form = new FormGroup({
    date: new FormControl<Date | null>(null),
    time: new FormControl<string>('', { nonNullable: true }),
    writeMessage: new FormControl<boolean>(true, { nonNullable: true }),
  });
  readonly today = new Date();
  saving = false;

  constructor(
    private readonly ref: MatDialogRef<BookingRescheduleDialogComponent, BookingRescheduleResult>,
    @Inject(MAT_DIALOG_DATA) readonly data: BookingRescheduleDialogData
  ) {}

  get hasConversation(): boolean {
    return !!this.data.booking.conversationId;
  }

  /** Both the day and the time, or neither: half a time is not one. */
  get incomplete(): boolean {
    const { date, time } = this.form.getRawValue();
    return !!date !== !!time;
  }

  get slot(): string | null {
    const { date, time } = this.form.getRawValue();
    return date && time ? slotLocal(date, time) : null;
  }

  save(): void {
    if (this.saving || this.incomplete) {
      return;
    }
    this.saving = true;
    this.data
      .save(this.slot)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (booking) => this.ref.close({ booking, writeMessage: this.hasConversation && this.form.controls.writeMessage.value }),
        // The error interceptor says why ("Pick a time in the future."); the dialog stays so it can be fixed.
        error: () => undefined,
      });
  }
}

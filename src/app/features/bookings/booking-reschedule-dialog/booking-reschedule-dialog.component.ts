import { Component, Inject, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { Booking, BookingMessage, rescheduleMessage, slotLabelLocal, slotLocal } from '../../../core/models/booking.model';

export interface BookingRescheduleDialogData {
  booking: Booking;
  /** The workspace's own time zone: the times picked here are read in it. */
  timezone: string | null;
  /** Saves the booking as Reschedule with this time ("2026-11-04T11:00"), or none, the reason it is being moved, and the message to send the customer (or none). The
   * dialog stays open if it fails, so the problem can be acted on. */
  save: (newSlotLocal: string | null, reason: string, message: BookingMessage | null) => Observable<Booking>;
}

export interface BookingRescheduleResult {
  /** The booking as saved. Its messageResults say how each channel of the message went. */
  booking: Booking;
}

/**
 * Marking a booking Reschedule: say why, pick the new date and time (or leave it for later), and tell the customer - by email, WhatsApp or both - with a message
 * ready to read and change, where the team can add anything else the customer needs, such as a Zoom or Meet link. The time is the team's own clock - the
 * workspace's time zone, stated in the dialog - so what is picked here is what the customer is told.
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
      .reason {
        width: 100%;
        margin: 12px 0;
      }
      .zone,
      .hint {
        font-size: 12px;
        margin: 0 0 12px;
      }
      .message-title {
        margin: 16px 0 4px;
        font-size: 14px;
      }
      .channels {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class BookingRescheduleDialogComponent implements OnDestroy {
  readonly form = new FormGroup({
    date: new FormControl<Date | null>(null),
    time: new FormControl<string>('', { nonNullable: true }),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500), this.notBlank] }),
    message: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    sendEmail: new FormControl<boolean>(true, { nonNullable: true }),
    sendWhatsApp: new FormControl<boolean>(true, { nonNullable: true }),
  });
  readonly today = new Date();
  saving = false;

  private readonly subscription = new Subscription();

  constructor(
    private readonly ref: MatDialogRef<BookingRescheduleDialogComponent, BookingRescheduleResult>,
    @Inject(MAT_DIALOG_DATA) readonly data: BookingRescheduleDialogData
  ) {
    const { sendEmail, sendWhatsApp, message } = this.form.controls;
    // A channel with nowhere to send is switched off, not left ticked: the customer has no address, or the booking has no conversation (Test chat).
    if (!this.hasEmail) {
      sendEmail.setValue(false);
      sendEmail.disable();
    }
    if (!this.hasConversation) {
      sendWhatsApp.setValue(false);
      sendWhatsApp.disable();
    }

    message.setValue(this.draft());
    // The draft follows the picked time until the team writes in the box themselves; after that it is theirs and is never overwritten.
    this.subscription.add(this.form.controls.date.valueChanges.subscribe(() => this.refreshDraft()));
    this.subscription.add(this.form.controls.time.valueChanges.subscribe(() => this.refreshDraft()));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /** A reason of only spaces is not one. */
  private notBlank(control: { value: string }): { blank: true } | null {
    return control.value && !control.value.trim() ? { blank: true } : null;
  }

  get hasConversation(): boolean {
    return !!this.data.booking.conversationId;
  }

  get hasEmail(): boolean {
    return !!this.data.booking.customerEmail;
  }

  /** Whether there is any way to reach the customer from here. */
  get canMessage(): boolean {
    return this.hasEmail || this.hasConversation;
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

  /** The message to send, or null when the box is empty (nothing is sent) or there is no way to reach the customer. */
  get message(): BookingMessage | null {
    const { message, sendEmail, sendWhatsApp } = this.form.getRawValue();
    const text = message.trim();
    return text && this.canMessage ? { text, sendEmail, sendWhatsApp } : null;
  }

  /** A message was written but neither channel is ticked: there is nowhere for it to go. */
  get needsChannel(): boolean {
    const message = this.message;
    return !!message && !message.sendEmail && !message.sendWhatsApp;
  }

  get cannotSave(): boolean {
    return this.saving || this.incomplete || this.form.controls.reason.invalid || this.form.controls.message.invalid || this.needsChannel;
  }

  save(): void {
    if (this.cannotSave) {
      this.form.controls.reason.markAsTouched();
      return;
    }
    this.saving = true;
    this.data
      .save(this.slot, this.form.controls.reason.value.trim(), this.message)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (booking) => this.ref.close({ booking }),
        // The error interceptor says why ("Pick a time in the future."); the dialog stays so it can be fixed.
        error: () => undefined,
      });
  }

  private draft(): string {
    const { date, time } = this.form.getRawValue();
    return rescheduleMessage(this.data.booking, date && time ? slotLabelLocal(date, time, this.data.timezone) : null);
  }

  private refreshDraft(): void {
    if (!this.form.controls.message.dirty) {
      this.form.controls.message.setValue(this.draft());
    }
  }
}

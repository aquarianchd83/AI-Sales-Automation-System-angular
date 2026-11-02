import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { Booking, BookingMessage, BookingMessageResult } from '../../../core/models/booking.model';

export interface BookingMessageDialogData {
  booking: Booking;
  /** Sends the message and answers with how each channel went. The dialog stays open if the request itself fails. */
  send: (message: BookingMessage) => Observable<BookingMessageResult[]>;
}

/**
 * Send the customer of a booking something - a Zoom or Meet link, how to join, anything the demo needs - by email, WhatsApp or both, without touching the booking.
 * A channel with nowhere to send (no email address on file, no WhatsApp conversation) is switched off and says so.
 */
@Component({
  selector: 'app-booking-message-dialog',
  templateUrl: './booking-message-dialog.component.html',
  styles: [
    `
      .intro {
        margin: 0 0 16px;
      }
      .message {
        width: 100%;
        margin-bottom: 12px;
      }
      .channels {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .note {
        font-size: 12px;
        margin: 8px 0 0;
      }
    `,
  ],
})
export class BookingMessageDialogComponent {
  readonly form = new FormGroup({
    text: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000), this.notBlank] }),
    sendEmail: new FormControl<boolean>(true, { nonNullable: true }),
    sendWhatsApp: new FormControl<boolean>(true, { nonNullable: true }),
  });
  sending = false;

  constructor(
    private readonly ref: MatDialogRef<BookingMessageDialogComponent, BookingMessageResult[]>,
    @Inject(MAT_DIALOG_DATA) readonly data: BookingMessageDialogData
  ) {
    if (!this.hasEmail) {
      this.form.controls.sendEmail.setValue(false);
      this.form.controls.sendEmail.disable();
    }
    if (!this.hasConversation) {
      this.form.controls.sendWhatsApp.setValue(false);
      this.form.controls.sendWhatsApp.disable();
    }
  }

  /** A message of only spaces is not one. */
  private notBlank(control: { value: string }): { blank: true } | null {
    return control.value && !control.value.trim() ? { blank: true } : null;
  }

  get hasEmail(): boolean {
    return !!this.data.booking.customerEmail;
  }

  get hasConversation(): boolean {
    return !!this.data.booking.conversationId;
  }

  get noChannel(): boolean {
    const { sendEmail, sendWhatsApp } = this.form.getRawValue();
    return !sendEmail && !sendWhatsApp;
  }

  get cannotSend(): boolean {
    return this.sending || this.form.invalid || this.noChannel;
  }

  send(): void {
    if (this.cannotSend) {
      this.form.controls.text.markAsTouched();
      return;
    }
    const { text, sendEmail, sendWhatsApp } = this.form.getRawValue();
    this.sending = true;
    this.data
      .send({ text: text.trim(), sendEmail, sendWhatsApp })
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        // Closes with how each channel went, even when one did not: the list says which, and the team follows up another way.
        next: (results) => this.ref.close(results),
        error: () => undefined,
      });
  }
}

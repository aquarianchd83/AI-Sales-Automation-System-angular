/** Where a booking has got to. Every booking starts Pending; the team marks it Done, or Reschedule when the time has to change. */
export type BookingStatus = 'Pending' | 'Done' | 'Reschedule';

export const BOOKING_STATUSES: BookingStatus[] = ['Pending', 'Done', 'Reschedule'];

/** One demo, visit or appointment a customer agreed with the AI (GET /bookings). */
export interface Booking {
  id: string;
  createdAtUtc: string;
  /** What it is, in a word: "Demo", "Site visit", "Appointment"... */
  kind: string;
  /** What was agreed: what, when, in which time zone, and what to cover. */
  summary: string;
  customerName: string | null;
  customerPhone: string | null;
  /** The conversation it was agreed in; null for one made in Test chat. */
  conversationId: string | null;
  /** Made by trying the AI in Test chat, not by a customer. */
  isTest: boolean;
  status: BookingStatus;
  /** The new time picked when it was marked Reschedule, if one was (UTC). Only present while the status is Reschedule. */
  newSlotUtc: string | null;
  /** Why it was rescheduled, as the team typed it. Only present while the status is Reschedule. */
  rescheduleReason?: string | null;
  /** Where the customer can be emailed: the address they gave in the chat, or the one on their record; null when there is none. */
  customerEmail?: string | null;
  /** How the confirmation email went: Sent, Failed or Skipped. Null when none was sent. */
  confirmationStatus?: 'Sent' | 'Failed' | 'Skipped' | null;
  /** Why it was not sent, so the team can contact the customer themselves. */
  confirmationNote?: string | null;
  /** Only on the answer to a change or a message: how each channel of the message the team sent went. */
  messageResults?: BookingMessageResult[] | null;
}

/** How one channel of a message to the customer went. Skipped means the channel did not apply (no address, no conversation). */
export interface BookingMessageResult {
  channel: 'Email' | 'WhatsApp';
  status: 'Sent' | 'Failed' | 'Skipped';
  note?: string | null;
}

/** What the team sends the customer of a booking, and by which channels. */
export interface BookingMessage {
  text: string;
  sendEmail: boolean;
  sendWhatsApp: boolean;
}

/** The outcome of a message in words for a toast: what went, and what did not and why. ok is false when any channel did not go. */
export function messageOutcome(results: BookingMessageResult[] | null | undefined): { text: string; ok: boolean } {
  if (!results?.length) {
    return { text: '', ok: true };
  }
  const label = (channel: string) => (channel === 'Email' ? 'email' : 'WhatsApp');
  const sent = results.filter((r) => r.status === 'Sent').map((r) => label(r.channel));
  const problems = results.filter((r) => r.status !== 'Sent').map((r) => label(r.channel) + ' not sent' + (r.note ? ' (' + r.note + ')' : ''));
  const parts = [sent.length ? 'Message sent by ' + sent.join(' and ') + '.' : '', problems.length ? problems.join('; ') + '.' : ''];
  return { text: parts.filter(Boolean).join(' '), ok: problems.length === 0 };
}

/** A new date and time as the team picked it, in words: "Wed, 4 Nov at 11:00 am (Asia/Kolkata)". The wall clock is used as picked - it is the tenant's own. */
export function slotLabelLocal(date: Date, time: string, timeZone: string | null): string {
  const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  const [hours, minutes] = time.split(':').map(Number);
  const clock = (hours % 12 || 12) + ':' + String(minutes).padStart(2, '0') + ' ' + (hours < 12 ? 'am' : 'pm');
  return day + ' at ' + clock + (timeZone ? ' (' + timeZone + ')' : '');
}

/**
 * The message offered when a booking is rescheduled: the new time when one was picked, a question when not, and a line that the joining details (a meeting link) will
 * follow. A draft to read and change, never sent without the team pressing the button.
 */
export function rescheduleMessage(booking: Pick<Booking, 'customerName' | 'kind'>, slotLabel: string | null): string {
  const first = booking.customerName?.trim().split(/\s+/)[0];
  const greeting = first ? 'Hi ' + first : 'Hi';
  const what = booking.kind.toLowerCase();
  return slotLabel
    ? greeting + ', your ' + what + ' has been moved to ' + slotLabel + '. We will share the joining details here. Please let us know if this time does not suit you.'
    : greeting + ', we need to move your ' + what + '. What day and time would suit you?';
}

/** The date and time as the tenant's clock reads it, the way the API takes a new slot: "2026-11-04T11:00", no zone. */
export function slotLocal(date: Date, time: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`;
}

/** A moment in words, in the tenant's own time zone: "Wed, 4 Nov, 11:00 am IST". */
export function slotText(utc: string, timeZone: string | null): string {
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(utc) ? utc : `${utc}Z`;
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

/**
 * A message the team can send the customer once a booking is marked Reschedule: it proposes the new time when one was picked, and asks for a time that suits them
 * when not. A draft to read and change, never sent for them.
 */
export function rescheduleDraft(booking: Pick<Booking, 'customerName' | 'kind'>, newSlotUtc: string | null, timeZone: string | null): string {
  const first = booking.customerName?.trim().split(/\s+/)[0];
  const greeting = first ? `Hi ${first}` : 'Hi';
  const what = booking.kind.toLowerCase();
  return newSlotUtc
    ? `${greeting}, we need to move your ${what}. Could we do ${slotText(newSlotUtc, timeZone)} instead? Please let us know if that works for you.`
    : `${greeting}, we need to move your ${what}. What day and time would suit you?`;
}

/** What narrows the list. Left out, every real booking of every status is listed. */
export interface BookingFilter {
  /** Also list what was booked while trying the AI in Test chat. */
  includeTests?: boolean;
  status?: BookingStatus | null;
  /** Only what is not Done yet - what the dashboard tile counts. */
  outstanding?: boolean;
}

/** The chip class for each status: waiting, finished, needs a new time. */
export function bookingStatusChipClass(status: BookingStatus): string {
  switch (status) {
    case 'Done':
      return 'status-chip status-chip--opted-in';
    case 'Reschedule':
      return 'status-chip status-chip--pending';
    default:
      return 'status-chip status-chip--scheduled';
  }
}

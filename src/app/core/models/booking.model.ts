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

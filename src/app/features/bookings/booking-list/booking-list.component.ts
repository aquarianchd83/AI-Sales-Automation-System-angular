import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { finalize } from 'rxjs/operators';

import {
  BOOKING_STATUSES,
  Booking,
  BookingMessage,
  BookingMessageResult,
  BookingStatus,
  bookingStatusChipClass,
  messageOutcome,
  slotText,
} from '../../../core/models/booking.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { BookingService } from '../../../core/services/booking.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantProfileService } from '../../../core/services/tenant-profile.service';
import { BookingMessageDialogComponent, BookingMessageDialogData } from '../booking-message-dialog/booking-message-dialog.component';
import {
  BookingRescheduleDialogComponent,
  BookingRescheduleDialogData,
  BookingRescheduleResult,
} from '../booking-reschedule-dialog/booking-reschedule-dialog.component';

/**
 * Demos scheduled: what customers agreed with the AI - a demo, a visit, an appointment - newest first, with who, when and what to cover. The AI has no calendar,
 * so this list is what makes each one real: someone needs to be ready for it. Each is marked Pending, Done or Reschedule here, and its conversation opens in a
 * panel beside the list so the team can reply (to agree a new time, say) without leaving the page. The dashboard's tile opens here.
 */
@Component({
  selector: 'app-booking-list',
  templateUrl: './booking-list.component.html',
  styleUrls: ['./booking-list.component.scss'],
})
export class BookingListComponent implements OnInit {
  readonly displayedColumns = ['createdAt', 'customer', 'kind', 'summary', 'status', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statuses = BOOKING_STATUSES;
  readonly statusClass = bookingStatusChipClass;
  readonly statusFilters: { label: string; value: BookingStatus | null }[] = [
    { label: 'All', value: null },
    { label: 'Pending', value: 'Pending' },
    { label: 'Reschedule', value: 'Reschedule' },
    { label: 'Done', value: 'Done' },
  ];

  page: PagedResult<Booking> = emptyPage<Booking>();
  loading = true;
  failed = false;
  /** Also list what was booked while trying the AI in Test chat. */
  includeTests = false;
  statusFilter: BookingStatus | null = null;
  /** The booking whose conversation is open beside the list. */
  selected: Booking | null = null;
  /** Bookings whose new status is on its way to the server. */
  readonly saving = new Set<string>();
  /** The workspace's time zone, which new times are picked and shown in; null until known (times then show in the browser's). */
  timezone: string | null = null;
  /** A message ready in the open conversation's box. Nothing sets one now - rescheduling sends its message itself - but the panel still takes it. */
  draft: string | null = null;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };

  constructor(
    private readonly bookings: BookingService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog,
    private readonly profile: TenantProfileService
  ) {}

  ngOnInit(): void {
    this.load();
    // Only for showing times; the list works without it.
    this.profile.getProfile().subscribe({ next: (p) => (this.timezone = p.timezone), error: () => undefined });
  }

  setIncludeTests(include: boolean): void {
    this.includeTests = include;
    this.restart();
  }

  setStatusFilter(status: BookingStatus | null): void {
    this.statusFilter = status;
    this.restart();
  }

  onPage(event: PageEvent): void {
    this.query = { page: event.pageIndex + 1, pageSize: event.pageSize };
    this.load();
  }

  /** The conversation opens in the panel; a booking from Test chat has none. */
  openConversation(booking: Booking): void {
    this.selected = booking.conversationId ? booking : null;
    this.draft = null;
  }

  closePanel(): void {
    this.selected = null;
    this.draft = null;
  }

  /** What the panel shows above the chat, so the reply has its context. */
  panelContext(booking: Booking): string {
    return `${booking.kind}: ${booking.summary}`;
  }

  /** Reschedule asks for the new time first; the other statuses save at once. */
  changeStatus(booking: Booking, status: BookingStatus): void {
    if (this.saving.has(booking.id)) {
      return;
    }
    if (status === 'Reschedule') {
      this.reschedule(booking);
      return;
    }
    if (status === booking.status) {
      return;
    }
    this.saving.add(booking.id);
    this.bookings
      .setStatus(booking.id, status)
      .pipe(finalize(() => this.saving.delete(booking.id)))
      .subscribe({
        next: (updated) => {
          this.notify.success(`${updated.kind} marked ${updated.status}.`);
          this.applyUpdate(updated);
        },
        // The error interceptor says why; the list keeps what it had.
        error: () => this.resetRows(),
      });
  }

  /**
   * Pick the new slot for a booking being marked Reschedule (or change the one already picked). Cancelling leaves the booking as it was, and the status select goes
   * back to showing it. Saving can offer a message to the customer, ready in the conversation panel.
   */
  reschedule(booking: Booking): void {
    const ref = this.dialog.open<BookingRescheduleDialogComponent, BookingRescheduleDialogData, BookingRescheduleResult>(BookingRescheduleDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: {
        booking,
        timezone: this.timezone,
        save: (newSlotLocal: string | null, reason: string, message: BookingMessage | null) =>
          this.bookings.setStatus(booking.id, 'Reschedule', newSlotLocal, reason, message),
      },
    });
    ref.afterClosed().subscribe((result) => {
      if (!result) {
        this.resetRows();
        return;
      }
      const { booking: updated } = result;
      const moved = updated.newSlotUtc ? `${updated.kind} moved to ${slotText(updated.newSlotUtc, this.timezone)}.` : `${updated.kind} marked Reschedule.`;
      const outcome = messageOutcome(updated.messageResults);
      // The booking is rescheduled either way; a message that did not go is said plainly, so the team knows to follow up another way.
      this.tell(outcome.ok, outcome.text ? moved + ' ' + outcome.text : moved);
      this.applyUpdate(updated);
    });
  }

  /** Email and/or WhatsApp the customer something - a meeting link, joining details - without changing the booking. */
  sendDetails(booking: Booking): void {
    const ref = this.dialog.open<BookingMessageDialogComponent, BookingMessageDialogData, BookingMessageResult[]>(BookingMessageDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: { booking, send: (message: BookingMessage) => this.bookings.message(booking.id, message) },
    });
    ref.afterClosed().subscribe((results) => {
      const outcome = messageOutcome(results);
      if (outcome.text) {
        this.tell(outcome.ok, outcome.text);
      }
    });
  }

  private tell(ok: boolean, text: string): void {
    if (ok) {
      this.notify.success(text);
    } else {
      this.notify.error(text);
    }
  }

  /** The new time in words, in the workspace's time zone. */
  slotText(booking: Booking): string {
    return booking.newSlotUtc ? slotText(booking.newSlotUtc, this.timezone) : '';
  }

  /** Put an updated booking where it stands: it leaves the list if a chosen status filter no longer matches it. */
  private applyUpdate(updated: Booking): void {
    if (this.selected?.id === updated.id) {
      this.selected = updated;
    }
    if (this.statusFilter && this.statusFilter !== updated.status) {
      this.load();
    } else {
      this.page = { ...this.page, items: this.page.items.map((b) => (b.id === updated.id ? updated : b)) };
    }
  }

  /** New row objects, so each status select goes back to showing what is saved. */
  private resetRows(): void {
    this.page = { ...this.page, items: this.page.items.map((b) => ({ ...b })) };
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.bookings
      .getPaged(this.query, { includeTests: this.includeTests, status: this.statusFilter })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (page) => {
          this.page = page;
          // The open conversation stays open only while its booking is still on the page.
          if (this.selected && !page.items.some((b) => b.id === this.selected!.id)) {
            this.selected = null;
          }
        },
        error: () => (this.failed = true),
      });
  }

  private restart(): void {
    this.query = { ...this.query, page: 1 };
    this.load();
  }
}

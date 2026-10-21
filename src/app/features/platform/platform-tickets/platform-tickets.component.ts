import { Component, OnInit } from '@angular/core';

import { PLATFORM_TICKET_STATUS_LABELS, PlatformTicket, PlatformTicketStatus } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTicketService } from '../../../core/services/platform-ticket.service';

@Component({
  selector: 'app-platform-tickets',
  templateUrl: './platform-tickets.component.html',
  styleUrls: ['./platform-tickets.component.scss'],
})
export class PlatformTicketsComponent implements OnInit {
  readonly statusLabels = PLATFORM_TICKET_STATUS_LABELS;
  readonly statuses: PlatformTicketStatus[] = ['Open', 'InProgress', 'Resolved'];

  tickets: PlatformTicket[] = [];
  /** Null shows everything, unresolved first. */
  filter: PlatformTicketStatus | null = null;
  loading = true;
  busyId: string | null = null;

  constructor(
    private readonly service: PlatformTicketService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  setFilter(status: PlatformTicketStatus | null): void {
    this.filter = status;
    this.load();
  }

  setStatus(ticket: PlatformTicket, status: PlatformTicketStatus): void {
    if (this.busyId) {
      return;
    }
    this.busyId = ticket.id;
    this.service.setStatus(ticket.id, status).subscribe({
      next: () => {
        this.busyId = null;
        this.notify.success(status === 'Resolved' ? 'Ticket resolved.' : 'Ticket updated.');
        this.load();
      },
      error: () => (this.busyId = null),
    });
  }

  private load(): void {
    this.loading = true;
    this.service.getAll(this.filter ?? undefined).subscribe({
      next: (tickets) => {
        this.tickets = tickets;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }
}

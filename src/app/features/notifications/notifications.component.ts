import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { Subject, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap, takeUntil } from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { DeliveryStatus, TenantNotification, isUrgentNotification, tenantNotificationRoute } from '../../core/models/billing.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../core/models/paged-result.model';
import { PLATFORM_ADMIN_ROLES, PlatformNotification, platformNotificationRoute } from '../../core/models/platform.model';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { NotificationsChangedService } from '../../core/services/notifications-changed.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';

/** One row of the screen, whichever kind of notification it came from. */
export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  acknowledged: boolean;
  /** Drawn in a warning colour: something has stopped or is about to. */
  urgent: boolean;
  /** Who/what it is about - the tenant for a platform alert, how it was delivered for a tenant one. */
  meta: string | null;
  /** Where opening it goes. */
  link: string;
}

export type NotificationFilter = 'all' | 'unread';

const DELIVERY_LABEL: Record<number, string> = {
  [DeliveryStatus.Sent]: 'sent',
  [DeliveryStatus.Failed]: 'failed',
};

/**
 * The full notification list behind the bell's "More notifications" button: every notification, newest first, a page at a
 * time, with an unread filter, search, mark-as-read and delete. A tenant Admin sees their billing alerts; the platform
 * operator sees the job alerts. The bell only ever holds the latest few, so this is where older ones are found.
 */
@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly isPlatform = this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  filter: NotificationFilter = 'all';
  page: PagedResult<NotificationRow> = emptyPage<NotificationRow>();
  loading = true;
  failed = false;
  busy = false;
  /** The tenant's IANA zone - billing times are shown in it, whoever is reading. Null for the platform operator. */
  tenantTimezone: string | null = null;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly auth: AuthService,
    private readonly billing: BillingService,
    private readonly platform: PlatformNotificationService,
    private readonly tenantProfile: TenantProfileService,
    private readonly changed: NotificationsChangedService,
    private readonly router: Router,
    private readonly dialog: MatDialog
  ) {}

  get title(): string {
    return this.isPlatform ? 'Platform alerts' : 'Notifications';
  }

  get subtitle(): string {
    return this.isPlatform
      ? 'New signups, refund requests, renewals that could not happen, and background jobs that fail or recover. Shared by every operator.'
      : 'Alerts about your credits, quota and plan.';
  }

  get hasUnread(): boolean {
    return this.page.items.some((n) => !n.acknowledged);
  }

  ngOnInit(): void {
    if (!this.isPlatform) {
      this.tenantProfile.getProfile().subscribe({
        next: (profile) => (this.tenantTimezone = profile.timezone ?? null),
        error: () => undefined,
      });
    }

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.reload$
      .pipe(
        switchMap(() => {
          this.loading = true;
          this.failed = false;
          return this.fetch().pipe(
            // Caught inside the projection so one failed request does not end paging and search for the rest of the page's life.
            catchError(() => {
              this.failed = true;
              return of(emptyPage<NotificationRow>(this.query.pageSize));
            }),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));

    this.reload$.next();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setFilter(filter: NotificationFilter): void {
    if (filter === this.filter) {
      return;
    }
    this.filter = filter;
    this.query = { ...this.query, page: 1 };
    this.paginator?.firstPage();
    this.reload$.next();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  retry(): void {
    this.reload$.next();
  }

  /** Opening a notification is the reader seeing it: mark it read, then go to where it points. */
  open(row: NotificationRow): void {
    if (!row.acknowledged) {
      this.markRead(row, false);
    }
    void this.router.navigateByUrl(row.link);
  }

  markRead(row: NotificationRow, reload = true): void {
    this.page = { ...this.page, items: this.page.items.map((n) => (n.id === row.id ? { ...n, acknowledged: true } : n)) };
    this.ack(row.id).subscribe({
      next: () => {
        this.changed.notify();
        if (reload && this.filter === 'unread') {
          this.reload$.next();
        }
      },
      error: () => this.reload$.next(),
    });
  }

  markAllRead(): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.ackAll()
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => {
          this.changed.notify();
          this.reload$.next();
        },
        error: () => undefined,
      });
  }

  delete(row: NotificationRow): void {
    const data: ConfirmDialogData = {
      title: 'Delete this notification?',
      message: `"${row.title}" will be removed for good.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.remove(row.id).subscribe({
          next: () => {
            this.changed.notify();
            // A page emptied by the delete steps back one rather than showing "nothing here" over earlier pages.
            if (this.page.items.length === 1 && (this.query.page ?? 1) > 1) {
              this.query = { ...this.query, page: (this.query.page ?? 1) - 1 };
              this.paginator?.previousPage();
            }
            this.reload$.next();
          },
          error: () => undefined,
        });
      });
  }

  // ---- the two kinds of notification behind one list ------------------------------------------------------------

  private fetch(): Observable<PagedResult<NotificationRow>> {
    const unreadOnly = this.filter === 'unread';
    return this.isPlatform
      ? this.platform.getHistory(this.query, unreadOnly).pipe(map((p) => this.mapPage(p, platformRow)))
      : this.billing.getNotificationHistory(this.query, unreadOnly).pipe(map((p) => this.mapPage(p, tenantRow)));
  }

  private mapPage<T>(page: PagedResult<T>, map: (item: T) => NotificationRow): PagedResult<NotificationRow> {
    return { ...page, items: page.items.map(map) };
  }

  private ack(id: string): Observable<void> {
    return this.isPlatform ? this.platform.acknowledge(id) : this.billing.acknowledgeNotification(id);
  }

  private ackAll(): Observable<void> {
    return this.isPlatform ? this.platform.acknowledgeAll() : this.billing.acknowledgeAllNotifications();
  }

  private remove(id: string): Observable<void> {
    return this.isPlatform ? this.platform.delete(id) : this.billing.deleteNotification(id);
  }
}

function platformRow(n: PlatformNotification): NotificationRow {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    acknowledged: n.acknowledged,
    urgent: n.severity === 'Critical',
    meta: n.tenantName,
    link: platformNotificationRoute(n),
  };
}

function tenantRow(n: TenantNotification): NotificationRow {
  const delivered = [
    DELIVERY_LABEL[n.emailStatus] ? `Email ${DELIVERY_LABEL[n.emailStatus]}` : null,
    DELIVERY_LABEL[n.whatsAppStatus] ? `WhatsApp ${DELIVERY_LABEL[n.whatsAppStatus]}` : null,
  ].filter((part): part is string => !!part);

  return {
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    acknowledged: n.acknowledged,
    urgent: isUrgentNotification(n.kind),
    meta: delivered.length ? delivered.join(' · ') : null,
    link: tenantNotificationRoute(n.kind),
  };
}

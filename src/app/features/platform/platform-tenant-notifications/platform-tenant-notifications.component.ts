import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  PlatformTenantNotification,
  PlatformTenantNotificationQuery,
  TENANT_NOTIFICATION_CHANNEL_LABELS,
  TenantNotificationChannel,
  TenantNotificationStatus,
} from '../../../core/models/platform.model';
import { PlatformTenantNotificationService } from '../../../core/services/platform-tenant-notification.service';

/** Notification kinds are enum names ("QuotaLow20"); on screen they read as words. */
export function kindLabel(kind: string): string {
  return kind
    .replace(/WhatsApp/g, 'Whatsapp')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2');
}

/**
 * Every notice sent to a tenant, one row per mode - in-app, email, WhatsApp message - with how that mode went: Pending (not sent yet), Sent, Failed, or Skipped
 * (the mode did not apply, e.g. no address on file). Platform-wide, newest first; read-only.
 */
@Component({
  selector: 'app-platform-tenant-notifications',
  templateUrl: './platform-tenant-notifications.component.html',
  styleUrls: ['./platform-tenant-notifications.component.scss'],
})
export class PlatformTenantNotificationsComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['createdAt', 'tenant', 'notification', 'channel', 'status'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly channelControl = new FormControl<TenantNotificationChannel | ''>('', { nonNullable: true });
  readonly statusControl = new FormControl<TenantNotificationStatus | ''>('', { nonNullable: true });
  readonly kindControl = new FormControl<string>('', { nonNullable: true });
  kinds: { value: string; label: string }[] = [];
  readonly kindLabel = kindLabel;

  page: PagedResult<PlatformTenantNotification> = emptyPage<PlatformTenantNotification>();
  loading = true;

  private query: PlatformTenantNotificationQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly notifications: PlatformTenantNotificationService) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => this.refilter({ search: search || undefined }));
    this.channelControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((channel) => this.refilter({ channel: channel || undefined }));
    this.statusControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((status) => this.refilter({ status: status || undefined }));
    this.kindControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((kind) => this.refilter({ kind: kind || undefined }));

    this.notifications
      .getKinds()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (kinds) => (this.kinds = kinds.map((value) => ({ value, label: kindLabel(value) })).sort((a, b) => a.label.localeCompare(b.label))), error: () => undefined });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.notifications.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformTenantNotification>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  channelLabel(channel: string): string {
    return TENANT_NOTIFICATION_CHANNEL_LABELS[channel] ?? channel;
  }

  channelIcon(channel: string): string {
    return channel === 'Email' ? 'mail' : channel === 'WhatsApp' ? 'chat' : 'notifications';
  }

  /** The in-app copy has no delivery to fail; what it can say is whether the tenant has dismissed it. */
  readNote(row: PlatformTenantNotification): string {
    return row.channel === 'InApp' ? (row.acknowledgedAtUtc ? 'Dismissed by the tenant' : 'Not dismissed yet') : '';
  }

  private refilter(change: Partial<PlatformTenantNotificationQuery>): void {
    this.query = { ...this.query, ...change, page: 1 };
    this.paginator?.firstPage();
    this.reload$.next();
  }
}

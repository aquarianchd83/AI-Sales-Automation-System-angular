import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  PlatformStoryVideoRequestDetail,
  PlatformStoryVideoRequestRow,
  STORY_VIDEO_REQUEST_STATUS_LABELS,
  StoryVideoRequestStatus,
} from '../../../core/models/story-studio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformStoryVideoRequestQuery, PlatformStoryVideoRequestService } from '../../../core/services/platform-story-video-request.service';
import { PlatformRefundVideoDialogComponent, PlatformRefundVideoDialogData } from '../platform-refund-video-dialog/platform-refund-video-dialog.component';

/**
 * Every tenant's request for a Story studio video, as a grid. The tenant already paid the video's price when raising it. A row opens the request on its
 * own page (script, video, refund); the Refund button on a row refunds it without leaving the grid: a dialog asks for the reason, which the tenant reads.
 */
@Component({
  selector: 'app-platform-video-requests',
  templateUrl: './platform-video-requests.component.html',
  styleUrls: ['./platform-video-requests.component.scss'],
})
export class PlatformVideoRequestsComponent implements OnInit, OnDestroy {
  readonly displayedColumns = ['raised', 'tenant', 'story', 'status', 'prepaid', 'length', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusLabels = STORY_VIDEO_REQUEST_STATUS_LABELS;
  readonly statuses: StoryVideoRequestStatus[] = ['Raised', 'ScriptReady', 'VideoReady', 'Rejected'];
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly statusControl = new FormControl<StoryVideoRequestStatus | ''>('', { nonNullable: true });

  page: PagedResult<PlatformStoryVideoRequestRow> = emptyPage<PlatformStoryVideoRequestRow>();
  loading = true;

  private query: PlatformStoryVideoRequestQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly requests: PlatformStoryVideoRequestService,
    private readonly notifications: NotificationService,
    private readonly dialog: MatDialog,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => this.refilter({ search: search || undefined }));
    this.statusControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((status) => this.refilter({ status: status || undefined }));

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.requests.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformStoryVideoRequestRow>(this.query.pageSize))),
            finalize(() => (this.loading = false)),
          );
        }),
        takeUntil(this.destroy$),
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

  private refilter(change: Partial<PlatformStoryVideoRequestQuery>): void {
    this.query = { ...this.query, ...change, page: 1 };
    this.reload$.next();
  }

  statusLabel(status: StoryVideoRequestStatus): string {
    return this.statusLabels[status] ?? status;
  }

  /** A row opens the request on its own page. */
  open(row: PlatformStoryVideoRequestRow): void {
    void this.router.navigate(['/platform/video-requests', row.id]);
  }

  /** A request that is still waiting and was not refunded yet: the admin can refund it when the video cannot be made. */
  canRefund(row: { status: StoryVideoRequestStatus }): boolean {
    return row.status === 'Raised' || row.status === 'ScriptReady';
  }

  /** The Refund button of a row: opens the refund dialog for that request, without opening the request's page. */
  refund(row: PlatformStoryVideoRequestRow, event: Event): void {
    event.stopPropagation();
    this.dialog
      .open<PlatformRefundVideoDialogComponent, PlatformRefundVideoDialogData, PlatformStoryVideoRequestDetail | null>(PlatformRefundVideoDialogComponent, {
        width: '520px',
        maxWidth: '95vw',
        data: { requestId: row.id, title: row.title, tenantName: row.tenantName, prepaidCredits: row.prepaidCredits },
      })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((detail) => {
        if (!detail) {
          return;
        }
        this.notifications.success('Credits refunded. The tenant has been told.');
        this.reload$.next();
      });
  }
}

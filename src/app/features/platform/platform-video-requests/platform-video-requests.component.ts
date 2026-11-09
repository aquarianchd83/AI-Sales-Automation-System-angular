import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
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

/** The video the tenant gets: uploaded by the platform admin, or (later) made by the system from the script. */
export type VideoChoice = 'upload' | 'generate';

/**
 * Every tenant's request for a Story studio video. The tenant already paid the video's price when raising it. The platform admin opens one, has the script
 * written (not charged again) and then either uploads the finished video or - once a real engine is switched on - has the system make it from the script. A video, however it came,
 * is stored under the tenant's folder, its link recorded on the request, and the tenant told in-app.
 */
@Component({
  selector: 'app-platform-video-requests',
  templateUrl: './platform-video-requests.component.html',
  styleUrls: ['./platform-video-requests.component.scss'],
})
export class PlatformVideoRequestsComponent implements OnInit, OnDestroy {
  readonly displayedColumns = ['raised', 'tenant', 'story', 'status', 'length'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusLabels = STORY_VIDEO_REQUEST_STATUS_LABELS;
  readonly statuses: StoryVideoRequestStatus[] = ['Raised', 'ScriptReady', 'VideoReady'];
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly statusControl = new FormControl<StoryVideoRequestStatus | ''>('', { nonNullable: true });

  page: PagedResult<PlatformStoryVideoRequestRow> = emptyPage<PlatformStoryVideoRequestRow>();
  loading = true;

  selected: PlatformStoryVideoRequestDetail | null = null;
  loadingDetail = false;
  /** The admin clicked "Generate script" and has not yet confirmed it. */
  confirmingScript = false;
  decliningOpen = false;
  declineReason = '';
  declineError = '';
  declining = false;
  writingScript = false;
  uploading = false;
  videoChoice: VideoChoice = 'upload';
  chosenFile: File | null = null;
  fileError = '';

  private query: PlatformStoryVideoRequestQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly requests: PlatformStoryVideoRequestService,
    private readonly notifications: NotificationService,
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

  open(row: PlatformStoryVideoRequestRow): void {
    this.loadingDetail = true;
    this.confirmingScript = false;
    this.decliningOpen = false;
    this.declineReason = '';
    this.declineError = '';
    this.chosenFile = null;
    this.fileError = '';
    this.requests
      .get(row.id)
      .pipe(finalize(() => (this.loadingDetail = false)), takeUntil(this.destroy$))
      .subscribe((detail) => (this.selected = detail));
  }

  close(): void {
    this.selected = null;
    this.confirmingScript = false;
  }

  // ----- the script -----

  askToWriteScript(): void {
    this.confirmingScript = true;
  }

  cancelScript(): void {
    this.confirmingScript = false;
  }

  writeScript(): void {
    const current = this.selected;
    if (!current || this.writingScript) {
      return;
    }
    this.writingScript = true;
    this.requests
      .generateScript(current.id)
      .pipe(finalize(() => ((this.writingScript = false), (this.confirmingScript = false))), takeUntil(this.destroy$))
      .subscribe((detail) => {
        this.selected = detail;
        this.notifications.success('Script written. The tenant is not charged again: the video price covers it.');
        this.reload$.next();
      });
  }

  // ----- declining -----

  openDecline(): void {
    this.decliningOpen = true;
    this.declineError = '';
  }

  cancelDecline(): void {
    this.decliningOpen = false;
    this.declineReason = '';
    this.declineError = '';
  }

  /** The video cannot be made: gives the tenant their credits back and says why. */
  decline(): void {
    const current = this.selected;
    if (!current || this.declining) {
      return;
    }
    const reason = this.declineReason.trim();
    if (!reason) {
      this.declineError = 'Say why: the tenant is told.';
      return;
    }
    this.declining = true;
    this.requests
      .reject(current.id, reason)
      .pipe(finalize(() => (this.declining = false)), takeUntil(this.destroy$))
      .subscribe((detail) => {
        this.selected = detail;
        this.decliningOpen = false;
        this.declineReason = '';
        this.notifications.success('Request declined. The credits went back to the tenant, who has been told.');
        this.reload$.next();
      });
  }

  /** The script as plain lines for reading: who says what, scene by scene. */
  get scriptLines(): { scene: number; speaker: string; text: string }[] {
    const scenes = this.selected?.script?.script?.scenes ?? [];
    return scenes.flatMap((s) => (s.dialogue ?? []).map((d) => ({ scene: s.index, speaker: d.speaker, text: d.text })));
  }

  // ----- the video -----

  chooseFile(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    this.fileError = '';
    this.chosenFile = null;
    if (!file) {
      return;
    }
    if (!file.type.startsWith('video/')) {
      this.fileError = 'Choose a video file (MP4, WebM or MOV).';
      return;
    }
    this.chosenFile = file;
  }

  upload(input: HTMLInputElement): void {
    const current = this.selected;
    if (!current || this.uploading) {
      return;
    }
    if (!this.chosenFile) {
      this.fileError = 'Choose a video file first.';
      return;
    }
    const file = this.chosenFile;
    this.uploading = true;
    this.requests
      .uploadVideo(current.id, file)
      .pipe(finalize(() => (this.uploading = false)), takeUntil(this.destroy$))
      .subscribe((detail) => {
        this.selected = detail;
        this.chosenFile = null;
        input.value = '';
        this.notifications.success('Video uploaded. The tenant has been told.');
        this.reload$.next();
      });
  }
}

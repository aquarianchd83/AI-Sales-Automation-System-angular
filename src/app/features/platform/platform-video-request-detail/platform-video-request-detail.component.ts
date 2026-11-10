import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import {
  PlatformStoryVideoRequestDetail,
  STORY_VIDEO_REQUEST_STATUS_LABELS,
  StoryVideoRequestStatus,
} from '../../../core/models/story-studio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformStoryVideoRequestService } from '../../../core/services/platform-story-video-request.service';
import { PlatformRefundVideoDialogComponent, PlatformRefundVideoDialogData } from '../platform-refund-video-dialog/platform-refund-video-dialog.component';

/** The video the tenant gets: uploaded by the platform admin, or (later) made by the system from the script. */
export type VideoChoice = 'upload' | 'generate';

export const MAX_SCRIPT_CHARS = 20000;

/**
 * One tenant's video request on its own page: what the tenant asked for, the script (a plain text box the admin writes and saves), the video (uploaded;
 * the system-made source is not switched on yet) and the refund. The tenant paid the video's price when raising the request, so nothing here charges.
 * A video is stored under the tenant's folder, its link recorded, and the tenant told in-app.
 */
@Component({
  selector: 'app-platform-video-request-detail',
  templateUrl: './platform-video-request-detail.component.html',
  styleUrls: ['./platform-video-request-detail.component.scss'],
})
export class PlatformVideoRequestDetailComponent implements OnInit, OnDestroy {
  readonly maxScript = MAX_SCRIPT_CHARS;
  readonly statusLabels = STORY_VIDEO_REQUEST_STATUS_LABELS;

  request: PlatformStoryVideoRequestDetail | null = null;
  loading = true;
  notFound = false;

  scriptText = '';
  scriptError = '';
  savingScript = false;

  videoChoice: VideoChoice = 'upload';
  chosenFile: File | null = null;
  fileError = '';
  uploading = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly requests: PlatformStoryVideoRequestService,
    private readonly notifications: NotificationService,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      this.notFound = true;
      return;
    }
    this.requests
      .get(id)
      .pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => this.show(detail),
        error: () => (this.notFound = true),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private show(detail: PlatformStoryVideoRequestDetail): void {
    this.request = detail;
    this.scriptText = detail.scriptText ?? '';
  }

  statusLabel(status: StoryVideoRequestStatus): string {
    return this.statusLabels[status] ?? status;
  }

  /** The script can be written and changed until the video is attached or the request is refunded. */
  get canEditScript(): boolean {
    return this.request?.status === 'Raised' || this.request?.status === 'ScriptReady';
  }

  get canRefund(): boolean {
    return this.canEditScript;
  }

  /** The text box differs from what is saved. */
  get scriptChanged(): boolean {
    return this.scriptText.trim() !== (this.request?.scriptText ?? '');
  }

  // ----- the script -----

  saveScript(): void {
    const current = this.request;
    if (!current || this.savingScript) {
      return;
    }
    const text = this.scriptText.trim();
    if (!text) {
      this.scriptError = 'Write the script first.';
      return;
    }
    if (text.length > this.maxScript) {
      this.scriptError = `The script is longer than ${this.maxScript.toLocaleString()} characters.`;
      return;
    }
    this.scriptError = '';
    this.savingScript = true;
    this.requests
      .saveScript(current.id, text)
      .pipe(finalize(() => (this.savingScript = false)), takeUntil(this.destroy$))
      .subscribe((detail) => {
        this.show(detail);
        this.notifications.success('Script saved. The tenant can read it.');
      });
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
    const current = this.request;
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
        this.show(detail);
        this.chosenFile = null;
        input.value = '';
        this.notifications.success('Video uploaded. The tenant has been told.');
      });
  }

  // ----- the refund -----

  /** Opens the refund dialog: it asks for the reason (the tenant reads it), refunds the prepaid credits, and closes with the updated request. */
  openRefundDialog(): void {
    const r = this.request;
    if (!r) {
      return;
    }
    this.dialog
      .open<PlatformRefundVideoDialogComponent, PlatformRefundVideoDialogData, PlatformStoryVideoRequestDetail | null>(PlatformRefundVideoDialogComponent, {
        width: '520px',
        maxWidth: '95vw',
        data: { requestId: r.id, title: r.title, tenantName: r.tenantName, prepaidCredits: r.prepaidCredits },
      })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((detail) => {
        if (!detail) {
          return;
        }
        this.show(detail);
        this.notifications.success('Credits refunded. The tenant has been told.');
      });
  }
}

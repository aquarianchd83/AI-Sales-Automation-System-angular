import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { STORY_VIDEO_REQUEST_STATUS_LABELS, StoryVideoRequestDetail, StoryVideoRequestStatus } from '../../../core/models/story-studio.model';
import { StoryStudioService } from '../../../core/services/story-studio.service';

/**
 * One requested video on its own page: where it stands, what was asked for, the script once the platform team has written it, the video (to watch and to
 * download), and the credits - with the reason when they were refunded. "Clone" starts a new story from the same answers.
 */
@Component({
  selector: 'app-studio-story-detail',
  templateUrl: './studio-story-detail.component.html',
  styleUrls: ['./studio-story-detail.component.scss'],
})
export class StudioStoryDetailComponent implements OnInit, OnDestroy {
  readonly statusLabels = STORY_VIDEO_REQUEST_STATUS_LABELS;

  request: StoryVideoRequestDetail | null = null;
  loading = true;
  notFound = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly studio: StoryStudioService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      this.notFound = true;
      return;
    }
    this.studio
      .getRequest(id)
      .pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (r) => (this.request = r),
        error: () => (this.notFound = true),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  statusLabel(status: StoryVideoRequestStatus): string {
    return this.statusLabels[status] ?? status;
  }

  get refunded(): boolean {
    return (this.request?.creditsRefunded ?? 0) > 0;
  }

  /** Saves the finished video as a file (the request carries the sign-in, so it cannot be a plain link). */
  download(): void {
    const r = this.request;
    if (!r?.videoUrl) {
      return;
    }
    this.studio
      .downloadRequestVideo(r.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((blob) => {
        const extension = blob.type === 'video/webm' ? '.webm' : blob.type === 'video/quicktime' ? '.mov' : '.mp4';
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${r.title}${extension}`;
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  /** Starts a new story from this one: New story opens with the same answers, to change and raise as a new request. */
  clone(): void {
    if (this.request) {
      void this.router.navigate(['/content-studio/stories/new'], { queryParams: { clone: this.request.projectId } });
    }
  }
}

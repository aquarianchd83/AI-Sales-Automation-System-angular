import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import {
  MEDIA_MAX_SIZE_BYTES,
  MediaAsset,
  absoluteMediaUrl,
  formatFileSize,
  isImageContentType,
  mediaKindLabel,
  mediaPreviewUrl,
  mediaThumbnailUrl,
} from '../../../core/models/media.model';
import { isUsableTemplateHeader } from '../../../core/models/message-template.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformMediaService } from '../../../core/services/platform-media.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * The platform's own media library - the images the WhatsApp notice templates show. Separate from every tenant's library: these files are the
 * operator's, listed only here. Meta fetches a template's image by its public link when a message is sent, so the media address has to be public.
 */
@Component({
  selector: 'app-platform-media',
  templateUrl: './platform-media.component.html',
  styleUrls: ['./platform-media.component.scss'],
})
export class PlatformMediaComponent implements OnInit, OnDestroy {
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly accept = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/3gpp'].join(',');
  readonly isImage = isImageContentType;
  readonly formatSize = formatFileSize;
  readonly kindLabel = mediaKindLabel;
  readonly preview = (url: string): string => mediaPreviewUrl(url, environment.apiBaseUrl);
  readonly thumb = (asset: MediaAsset): string | null => mediaThumbnailUrl(asset, environment.apiBaseUrl);
  /** Whether Meta can use the file as a template header. */
  readonly usableAsHeader = isUsableTemplateHeader;

  items: MediaAsset[] = [];
  loading = true;
  loadFailed = false;
  busy = false;
  /** The entry whose file is being replaced - the hidden file input serves both "add" and "replace". */
  private replacing: MediaAsset | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly media: PlatformMediaService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  /** Any file whose link Meta could not fetch: the server's MediaStorage PublicBaseUrl is not set. */
  get hasNonPublicLinks(): boolean {
    return this.items.some((a) => !a.isPublicUrl);
  }

  ngOnInit(): void {
    this.load();
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.media
      .getAll(this.searchControl.value)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (items) => (this.items = items),
        error: () => (this.loadFailed = true),
      });
  }

  /** Opens the file picker to add a new file. */
  chooseToAdd(input: HTMLInputElement): void {
    this.replacing = null;
    input.click();
  }

  /** Opens the file picker to swap the file behind an entry. */
  chooseToReplace(asset: MediaAsset, input: HTMLInputElement): void {
    this.replacing = asset;
    input.click();
  }

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || this.busy) {
      return;
    }

    const problem = this.check(file);
    if (problem) {
      this.notify.error(problem);
      return;
    }

    const target = this.replacing;
    this.busy = true;
    const request = target ? this.media.replace(target.id, file) : this.media.upload(file);
    request.pipe(finalize(() => (this.busy = false))).subscribe({
      next: () => {
        this.notify.success(target ? 'File replaced - every template using it shows the new one.' : 'Added to the media library.');
        this.load();
      },
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  async copyUrl(asset: MediaAsset): Promise<void> {
    try {
      await navigator.clipboard.writeText(absoluteMediaUrl(asset.url));
      this.notify.success('Public link copied.');
    } catch {
      this.notify.error('Could not copy the link.');
    }
  }

  delete(asset: MediaAsset): void {
    const data: ConfirmDialogData = {
      title: `Delete "${asset.fileName}"?`,
      message: 'This cannot be undone. An image a notice template still shows cannot be deleted - change it there first.',
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
        this.media.delete(asset.id).subscribe({
          next: () => {
            this.notify.success('Deleted.');
            this.load();
          },
          error: () => {
            // ErrorInterceptor toasts it (a 409 names the template that still shows the file).
          },
        });
      });
  }

  /** A fast-fail hint; the server re-checks the size and type regardless. */
  private check(file: File): string | null {
    if (file.size === 0) {
      return 'That file is empty.';
    }
    if (file.size > MEDIA_MAX_SIZE_BYTES) {
      return `That file is larger than ${formatFileSize(MEDIA_MAX_SIZE_BYTES)}.`;
    }
    if (!this.accept.split(',').includes(file.type.toLowerCase())) {
      return 'Use a JPEG, PNG or WebP image, or an MP4 or 3GP video.';
    }
    return null;
  }
}

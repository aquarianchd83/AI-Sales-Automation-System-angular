import { Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  MEDIA_ALLOWED_CONTENT_TYPES,
  MEDIA_MAX_SIZE_BYTES,
  MediaAsset,
  absoluteMediaUrl,
  formatFileSize,
  isImageContentType,
  mediaKindLabel,
  mediaPreviewUrl,
} from '../../../core/models/media.model';
import { environment } from '../../../../environments/environment';
import { MediaService } from '../../../core/services/media.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * What the dialog hands back: the caller owns the delete flow (it knows about the in-use confirmation), and
 * 'changed' tells it the file was replaced so the list reloads.
 */
export type MediaDetailResult = 'delete' | 'changed' | undefined;

@Component({
  selector: 'app-media-detail-dialog',
  templateUrl: './media-detail-dialog.component.html',
  styleUrls: ['./media-detail-dialog.component.scss'],
})
export class MediaDetailDialogComponent implements OnDestroy {
  readonly accept = MEDIA_ALLOWED_CONTENT_TYPES.join(',');
  readonly formatSize = formatFileSize;

  asset: MediaAsset;
  replaced = false;
  replacing = false;

  /** The file picked to replace this one, previewed before anything is sent. */
  pending: File | null = null;
  pendingUrl: string | null = null;
  pendingError: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) asset: MediaAsset,
    private readonly dialogRef: MatDialogRef<MediaDetailDialogComponent, MediaDetailResult>,
    private readonly media: MediaService,
    private readonly notify: NotificationService
  ) {
    this.asset = asset;
  }

  get isImage(): boolean {
    return isImageContentType(this.asset.contentType);
  }

  get kind(): string {
    return mediaKindLabel(this.asset.contentType);
  }

  get size(): string {
    return formatFileSize(this.asset.sizeBytes);
  }

  get publicUrl(): string {
    return absoluteMediaUrl(this.asset.url);
  }

  get previewUrl(): string {
    return mediaPreviewUrl(this.asset.previewUrl || this.asset.url, environment.apiBaseUrl);
  }

  /** False when Meta could not fetch the link (the platform's media storage has no public address yet). */
  get reachableByMeta(): boolean {
    return this.asset.isPublicUrl;
  }

  get pendingIsImage(): boolean {
    return !!this.pending && isImageContentType(this.pending.type);
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl);
      this.notify.success('Link copied.');
    } catch {
      this.notify.error('Could not copy - select the link and copy it by hand.');
    }
  }

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.choose(input.files?.[0] ?? null);
    input.value = '';
  }

  cancelReplace(): void {
    this.choose(null);
  }

  confirmReplace(): void {
    if (!this.pending || this.replacing) {
      return;
    }

    this.replacing = true;
    this.media
      .replace(this.asset.id, this.pending)
      .pipe(finalize(() => (this.replacing = false)))
      .subscribe({
        next: (updated) => {
          this.asset = updated;
          this.replaced = true;
          this.choose(null);
          this.notify.success('File replaced.');
        },
        error: () => {
          // ErrorInterceptor toasts the server's reason (type or size refused, storage unavailable).
        },
      });
  }

  delete(): void {
    this.dialogRef.close('delete');
  }

  close(): void {
    this.dialogRef.close(this.replaced ? 'changed' : undefined);
  }

  ngOnDestroy(): void {
    this.revokePending();
  }

  private choose(file: File | null): void {
    this.revokePending();
    this.pendingError = null;

    if (!file) {
      this.pending = null;
      return;
    }
    if (!MEDIA_ALLOWED_CONTENT_TYPES.includes(file.type)) {
      this.pending = null;
      this.pendingError = `"${file.type || 'unknown type'}" is not allowed. Use JPEG, PNG, WebP, MP4 or 3GP.`;
      return;
    }
    if (file.size > MEDIA_MAX_SIZE_BYTES) {
      this.pending = null;
      this.pendingError = `That file is larger than ${MEDIA_MAX_SIZE_BYTES / (1024 * 1024)} MB.`;
      return;
    }

    this.pending = file;
    this.pendingUrl = URL.createObjectURL(file);
  }

  private revokePending(): void {
    if (this.pendingUrl) {
      URL.revokeObjectURL(this.pendingUrl);
      this.pendingUrl = null;
    }
  }
}

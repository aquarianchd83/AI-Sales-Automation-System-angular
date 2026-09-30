import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  MediaAsset,
  absoluteMediaUrl,
  formatFileSize,
  isImageContentType,
  mediaKindLabel,
} from '../../../core/models/media.model';
import { NotificationService } from '../../../core/services/notification.service';

/** What the dialog hands back: the caller owns the delete flow (it knows about the in-use confirmation). */
export type MediaDetailResult = 'delete' | undefined;

@Component({
  selector: 'app-media-detail-dialog',
  templateUrl: './media-detail-dialog.component.html',
  styleUrls: ['./media-detail-dialog.component.scss'],
})
export class MediaDetailDialogComponent {
  readonly isImage = isImageContentType(this.asset.contentType);
  readonly kind = mediaKindLabel(this.asset.contentType);
  readonly size = formatFileSize(this.asset.sizeBytes);
  readonly publicUrl = absoluteMediaUrl(this.asset.url);
  /** False when Meta could not fetch the link (MediaStorage:PublicBaseUrl is not set, or points at localhost). */
  readonly reachableByMeta = this.asset.isPublicUrl;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly asset: MediaAsset,
    private readonly dialogRef: MatDialogRef<MediaDetailDialogComponent, MediaDetailResult>,
    private readonly notify: NotificationService
  ) {}

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl);
      this.notify.success('Link copied.');
    } catch {
      this.notify.error('Could not copy - select the link and copy it by hand.');
    }
  }

  delete(): void {
    this.dialogRef.close('delete');
  }

  close(): void {
    this.dialogRef.close(undefined);
  }
}

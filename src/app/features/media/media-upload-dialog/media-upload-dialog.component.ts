import { Component, OnDestroy } from '@angular/core';
import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { MEDIA_ALLOWED_CONTENT_TYPES, MEDIA_MAX_SIZE_BYTES, MediaAsset } from '../../../core/models/media.model';
import { MediaService } from '../../../core/services/media.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-media-upload-dialog',
  templateUrl: './media-upload-dialog.component.html',
  styleUrls: ['./media-upload-dialog.component.scss'],
})
export class MediaUploadDialogComponent implements OnDestroy {
  readonly accept = MEDIA_ALLOWED_CONTENT_TYPES.join(',');
  readonly maxSizeBytes = MEDIA_MAX_SIZE_BYTES;

  file: File | null = null;
  /** A blob link to the chosen file, so it can be looked at before it is uploaded. */
  filePreviewUrl: string | null = null;
  fileError: string | null = null;
  uploading = false;

  /** 'file' picks a file from this computer; 'link' registers a file the tenant already hosts. */
  mode: 'file' | 'link' = 'file';
  readonly urlControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\s*https?:\/\/\S+\s*$/i)],
  });
  progress = 0;

  constructor(
    private readonly media: MediaService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<MediaUploadDialogComponent, MediaAsset | undefined>
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectFile(input.files?.[0] ?? null);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.selectFile(event.dataTransfer?.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  upload(): void {
    if (!this.file || this.uploading) {
      return;
    }

    this.uploading = true;
    this.progress = 0;

    this.media.upload(this.file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress = Math.round((100 * event.loaded) / event.total);
        } else if (event instanceof HttpResponse) {
          this.notify.success('File uploaded.');
          this.dialogRef.close(event.body ?? undefined);
        }
      },
      error: (error: unknown) => {
        this.uploading = false;
        this.progress = 0;
        // 400 here is the server's own size/content-type rejection (MediaService.Invalid) —
        // ErrorInterceptor already toasts its message; nothing extra to add.
        if (!(error instanceof HttpErrorResponse)) {
          throw error;
        }
      },
    });
  }

  get canSubmit(): boolean {
    return !this.uploading && (this.mode === 'file' ? !!this.file : this.urlControl.valid);
  }

  submit(): void {
    if (this.mode === 'file') {
      this.upload();
    } else {
      this.addLink();
    }
  }

  addLink(): void {
    if (this.urlControl.invalid || this.uploading) {
      this.urlControl.markAsTouched();
      return;
    }

    this.uploading = true;
    this.media.addFromUrl(this.urlControl.value.trim()).subscribe({
      next: (asset) => {
        this.notify.success('File added.');
        this.dialogRef.close(asset);
      },
      error: () => {
        // ErrorInterceptor toasts the server's reason (unreachable, wrong type, too large, private address).
        this.uploading = false;
      },
    });
  }

  get fileIsImage(): boolean {
    return !!this.file && this.file.type.startsWith('image/');
  }

  /** The typed link, once it looks valid, so the tenant can see what they are about to add. */
  get linkPreview(): { url: string; isVideo: boolean } | null {
    const url = this.urlControl.value.trim();
    if (this.urlControl.invalid || !url) {
      return null;
    }
    return { url, isVideo: /\.(mp4|3gp)(\?.*)?$/i.test(url) };
  }

  linkPreviewFailed = false;

  ngOnDestroy(): void {
    this.revokePreview();
  }

  private revokePreview(): void {
    if (this.filePreviewUrl) {
      URL.revokeObjectURL(this.filePreviewUrl);
      this.filePreviewUrl = null;
    }
  }

  reset(): void {
    this.revokePreview();
    this.file = null;
    this.fileError = null;
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  private selectFile(file: File | null): void {
    this.revokePreview();
    this.fileError = null;

    if (!file) {
      this.file = null;
      return;
    }

    if (!MEDIA_ALLOWED_CONTENT_TYPES.includes(file.type)) {
      this.file = null;
      this.fileError = `"${file.type || 'unknown type'}" is not allowed. Use JPEG, PNG, WebP, MP4 or 3GP.`;
      return;
    }
    if (file.size > this.maxSizeBytes) {
      this.file = null;
      this.fileError = `That file is larger than ${this.maxSizeBytes / (1024 * 1024)} MB.`;
      return;
    }

    this.file = file;
    this.filePreviewUrl = URL.createObjectURL(file);
  }
}

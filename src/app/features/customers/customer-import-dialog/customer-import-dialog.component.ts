import { Component } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';

import { CustomerImportResult } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-customer-import-dialog',
  templateUrl: './customer-import-dialog.component.html',
  styleUrls: ['./customer-import-dialog.component.scss'],
})
export class CustomerImportDialogComponent {
  readonly accept = ACCEPTED_EXTENSIONS.join(',');

  file: File | null = null;
  fileError: string | null = null;
  uploading = false;
  progress = 0;
  result: CustomerImportResult | null = null;

  /** True once anything was written, so the list behind the dialog needs a refresh. */
  private touchedData = false;

  constructor(
    private readonly customers: CustomerService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CustomerImportDialogComponent, boolean>
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectFile(input.files?.[0] ?? null);
    // Reset so re-picking the same file still fires a change event.
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
    this.result = null;

    this.customers.import(this.file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress = Math.round((100 * event.loaded) / event.total);
        } else if (event instanceof HttpResponse) {
          this.uploading = false;
          this.result = event.body;
          this.touchedData = !!event.body && event.body.importedCount > 0;
          this.notify.success(
            `Import finished: ${event.body?.importedCount ?? 0} added, ${
              event.body?.skippedDuplicateCount ?? 0
            } duplicates skipped, ${event.body?.failedCount ?? 0} failed.`
          );
        }
      },
      error: () => {
        this.uploading = false;
        this.progress = 0;
      },
    });
  }

  reset(): void {
    this.file = null;
    this.result = null;
    this.progress = 0;
    this.fileError = null;
  }

  close(): void {
    this.dialogRef.close(this.touchedData);
  }

  private selectFile(file: File | null): void {
    this.result = null;
    this.fileError = null;

    if (!file) {
      this.file = null;
      return;
    }

    const name = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      this.file = null;
      this.fileError = 'Choose a .csv or .xlsx file.';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.file = null;
      this.fileError = 'That file is larger than 10 MB. Split it into smaller batches.';
      return;
    }

    this.file = file;
  }
}

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface TenantJobsDialogData {
  title: string;
  description: string;
  /** Only these job types are listed (e.g. CAMPAIGN_JOB_TYPES). */
  jobTypes: readonly string[];
}

/** The scheduled jobs of one area (campaigns, lead discovery) in a dialog opened from that area's page. */
@Component({
  selector: 'app-tenant-jobs-dialog',
  templateUrl: './tenant-jobs-dialog.component.html',
  styles: [
    `
      /* The whole table is meant to be seen at once: the dialog grows to its content instead of scrolling. */
      mat-dialog-content.jobs-content {
        max-height: none;
        overflow: visible;
        padding-top: 4px;
      }
      .jobs-intro {
        margin: 0 0 12px;
        font-size: 13px;
      }
    `,
  ],
})
export class TenantJobsDialogComponent {
  /** Width and max width every opener uses, so the table has room for its columns. */
  static readonly config = { width: '1000px', maxWidth: '96vw' } as const;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: TenantJobsDialogData,
    private readonly dialogRef: MatDialogRef<TenantJobsDialogComponent>
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}

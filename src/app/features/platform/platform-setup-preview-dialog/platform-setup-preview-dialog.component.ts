import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SetupDefinition } from '../../../core/models/application-setup.model';
import { PlatformSetupService } from '../../../core/services/platform-setup.service';

export interface PlatformSetupPreviewData {
  versionId: string;
}

/** The Talent's wizard for a version, exactly as they would see it - fully interactive, nothing saved. */
@Component({
  selector: 'app-platform-setup-preview-dialog',
  template: `
    <h2 mat-dialog-title>Preview — what a Talent sees</h2>
    <mat-dialog-content>
      <mat-progress-bar mode="indeterminate" *ngIf="!definition"></mat-progress-bar>
      <p class="muted" *ngIf="definition && !definition.sections.length">This version has no active questions yet.</p>
      <app-setup-wizard *ngIf="definition?.sections?.length" [definition]="definition!" mode="preview" (cancelled)="close()"></app-setup-wizard>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: ['mat-dialog-content { max-height: 78vh; background: #f5f6f8; }'],
})
export class PlatformSetupPreviewDialogComponent implements OnInit {
  definition: SetupDefinition | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) private readonly data: PlatformSetupPreviewData,
    private readonly service: PlatformSetupService,
    private readonly dialogRef: MatDialogRef<PlatformSetupPreviewDialogComponent>
  ) {}

  ngOnInit(): void {
    this.service.preview(this.data.versionId).subscribe((definition) => (this.definition = definition));
  }

  close(): void {
    this.dialogRef.close();
  }
}

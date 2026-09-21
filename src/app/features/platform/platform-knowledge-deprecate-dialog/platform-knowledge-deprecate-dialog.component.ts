import { Component, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface PlatformKnowledgeDeprecateData {
  title: string;
}

/** Asks for the reason a published article is being retired - the API requires one, so the next
 * person to read the article knows why it is no longer true. Closes with the note, or undefined. */
@Component({
  selector: 'app-platform-knowledge-deprecate-dialog',
  template: `
    <h2 mat-dialog-title>Deprecate "{{ data.title }}"?</h2>
    <mat-dialog-content>
      <p>It stops appearing in every tenant's support answers immediately. The article stays readable here.</p>
      <mat-form-field class="full-width">
        <mat-label>Reason</mat-label>
        <textarea matInput rows="3" maxlength="1000" [formControl]="note"></textarea>
        <mat-error>A reason is required.</mat-error>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="warn" type="button" (click)="confirm()">Deprecate</button>
    </mat-dialog-actions>
  `,
})
export class PlatformKnowledgeDeprecateDialogComponent {
  readonly note = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformKnowledgeDeprecateData,
    public readonly dialogRef: MatDialogRef<PlatformKnowledgeDeprecateDialogComponent, string>
  ) {}

  confirm(): void {
    const value = this.note.value.trim();
    if (!value) {
      this.note.markAsTouched();
      return;
    }
    this.dialogRef.close(value);
  }
}

import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { Handoff } from '../../../core/models/handoff.model';
import { HandoffService } from '../../../core/services/handoff.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface ResolveHandoffDialogData {
  handoff: Handoff;
}

@Component({
  selector: 'app-resolve-handoff-dialog',
  templateUrl: './resolve-handoff-dialog.component.html',
})
export class ResolveHandoffDialogComponent {
  readonly form = this.fb.nonNullable.group({
    notes: [this.data.handoff.notes ?? '', [Validators.maxLength(2000)]],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ResolveHandoffDialogData,
    private readonly fb: FormBuilder,
    private readonly handoffs: HandoffService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<ResolveHandoffDialogComponent, boolean>
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.handoffs.resolve(this.data.handoff.id, { notes: this.form.getRawValue().notes.trim() || null }).subscribe({
      next: () => {
        this.notify.success('Handoff resolved.');
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
        // ErrorInterceptor toasts it.
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

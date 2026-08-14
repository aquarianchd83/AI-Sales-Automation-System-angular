import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { TAG_NAME_MAX_LENGTH, Tag } from '../../../core/models/tag.model';
import { TagService } from '../../../core/services/tag.service';
import { tagNameValidator } from '../../../core/utils/tag-name.validator';

export interface TagFormDialogData {
  mode: 'create' | 'edit';
  tag?: Tag;
}

@Component({
  selector: 'app-tag-form-dialog',
  templateUrl: './tag-form-dialog.component.html',
})
export class TagFormDialogComponent {
  readonly isEdit = this.data.mode === 'edit';
  readonly maxLength = TAG_NAME_MAX_LENGTH;

  readonly form = this.fb.nonNullable.group({
    name: [
      this.data.tag?.name ?? '',
      [Validators.required, Validators.maxLength(TAG_NAME_MAX_LENGTH), tagNameValidator],
    ],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: TagFormDialogData,
    private readonly fb: FormBuilder,
    private readonly tags: TagService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<TagFormDialogComponent, boolean>
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.getRawValue().name.trim();
    const saved$: Observable<Tag> =
      this.isEdit && this.data.tag
        ? this.tags.update(this.data.tag.id, { name })
        : this.tags.create({ name });

    this.saving = true;
    saved$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Tag renamed.' : 'Tag created.');
        this.dialogRef.close(true);
      },
      error: () => {
        // ErrorInterceptor surfaces the 409 ("A tag named 'x' already exists.") —
        // keep the dialog open so the edit isn't lost.
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

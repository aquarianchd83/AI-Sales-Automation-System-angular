import { Component, Inject } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  QUALIFICATION_DATA_TYPES,
  QUALIFICATION_KEY_PATTERN,
  QUALIFICATION_LIMITS,
  QualificationField,
  needsChoices,
  parseChoices,
  suggestFieldKey,
} from '../../../core/models/qualification.model';
import { NotificationService } from '../../../core/services/notification.service';
import { QualificationService } from '../../../core/services/qualification.service';

export interface CustomerQuestionDialogData {
  mode: 'create' | 'edit';
  field?: QualificationField;
  /** Where a new question goes when nothing else decides it. */
  nextSortOrder: number;
}

/** A choice question with no choices cannot check what the customer said, so the API refuses it too. */
function choicesRequired(group: AbstractControl): ValidationErrors | null {
  const type = group.get('dataType')?.value as string;
  const choices = parseChoices((group.get('choices')?.value as string) ?? '');
  if (needsChoices(type) && choices.length === 0) {
    return { choicesRequired: true };
  }
  return choices.length > QUALIFICATION_LIMITS.maxAllowedValues ? { tooManyChoices: true } : null;
}

@Component({
  selector: 'app-customer-question-dialog',
  templateUrl: './customer-question-dialog.component.html',
})
export class CustomerQuestionDialogComponent {
  readonly isEdit = this.data.mode === 'edit';
  readonly limits = QUALIFICATION_LIMITS;
  readonly dataTypes = QUALIFICATION_DATA_TYPES;

  readonly form = this.fb.nonNullable.group(
    {
      displayName: [this.data.field?.displayName ?? '', [Validators.required, Validators.maxLength(QUALIFICATION_LIMITS.displayName)]],
      fieldKey: [
        this.data.field?.fieldKey ?? '',
        [Validators.required, Validators.maxLength(QUALIFICATION_LIMITS.fieldKey), Validators.pattern(QUALIFICATION_KEY_PATTERN)],
      ],
      question: [this.data.field?.question ?? '', [Validators.required, Validators.maxLength(QUALIFICATION_LIMITS.question)]],
      description: [this.data.field?.description ?? '', [Validators.maxLength(QUALIFICATION_LIMITS.description)]],
      dataType: [this.data.field?.dataType ?? 'Text', [Validators.required]],
      choices: [(this.data.field?.allowedValues ?? []).join('\n')],
      isRequired: [this.data.field?.isRequired ?? false],
      priority: [this.data.field?.priority ?? 50, [Validators.required, Validators.min(0), Validators.max(100)]],
    },
    { validators: choicesRequired }
  );

  saving = false;
  /** Once someone edits the key themselves, stop overwriting it from the name. */
  private keyTouched = this.isEdit;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CustomerQuestionDialogData,
    private readonly fb: FormBuilder,
    private readonly questions: QualificationService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CustomerQuestionDialogComponent, boolean>
  ) {
    if (this.isEdit) {
      this.form.controls.fieldKey.disable();
    }
  }

  get showChoices(): boolean {
    return needsChoices(this.form.controls.dataType.value);
  }

  onNameInput(): void {
    if (!this.keyTouched) {
      this.form.controls.fieldKey.setValue(suggestFieldKey(this.form.controls.displayName.value));
    }
  }

  onKeyInput(): void {
    this.keyTouched = true;
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const choices = needsChoices(v.dataType) ? parseChoices(v.choices) : null;
    const body = {
      displayName: v.displayName.trim(),
      description: v.description.trim() || null,
      question: v.question.trim(),
      dataType: v.dataType as QualificationField['dataType'],
      isRequired: v.isRequired,
      priority: Number(v.priority),
      // Not edited here: kept as they are so saving a wording change never resets them.
      scoreWeight: this.data.field?.scoreWeight ?? 0,
      allowedValues: choices,
      validationPattern: this.data.field?.validationPattern ?? null,
      sortOrder: this.data.field?.sortOrder ?? this.data.nextSortOrder,
    };

    const saved$: Observable<QualificationField> =
      this.isEdit && this.data.field
        ? this.questions.update(this.data.field.id, body)
        : this.questions.create({ ...body, fieldKey: v.fieldKey });

    this.saving = true;
    saved$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Question saved.' : 'Question added.');
        this.dialogRef.close(true);
      },
      // ErrorInterceptor shows the API's message (duplicate key, too many questions); keep the dialog so nothing typed is lost.
      error: () => undefined,
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { KNOWN_PLACEHOLDER_TOKENS, placeholderTokenValidator } from '../../../core/utils/placeholder-tokens';
import { MessageTemplate, TEMPLATE_CATEGORIES, WhatsAppTemplateStatus } from '../../../core/models/message-template.model';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface TemplateFormDialogData {
  mode: 'create' | 'edit';
  template?: MessageTemplate;
}

@Component({
  selector: 'app-template-form-dialog',
  templateUrl: './template-form-dialog.component.html',
  styleUrls: ['./template-form-dialog.component.scss'],
})
export class TemplateFormDialogComponent {
  readonly isEdit = this.data.mode === 'edit';
  readonly categories = TEMPLATE_CATEGORIES;
  readonly knownTokens = KNOWN_PLACEHOLDER_TOKENS;
  readonly bodyTextPlaceholderExample = 'Hi {{FirstName}}, your order is on its way.';

  readonly form = this.fb.nonNullable.group({
    // Name/language/category/WhatsApp template name are immutable after creation, so these
    // three controls exist only in create mode — the template shows them as read-only text
    // when editing.
    name: [this.data.template?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    language: [this.data.template?.language ?? 'en', [Validators.required, Validators.maxLength(10)]],
    category: [this.data.template?.category ?? this.categories[0], [Validators.required]],
    whatsAppTemplateName: [
      this.data.template?.whatsAppTemplateName ?? '',
      [Validators.required, Validators.maxLength(200)],
    ],
    bodyText: [
      this.data.template?.bodyText ?? '',
      [Validators.required, Validators.maxLength(2000), placeholderTokenValidator],
    ],
    isActive: [this.data.template?.isActive ?? true],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: TemplateFormDialogData,
    private readonly fb: FormBuilder,
    private readonly templates: MessageTemplateService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<TemplateFormDialogComponent, boolean>
  ) {}

  tokenLabel(token: string): string {
    return `{{${token}}}`;
  }

  insertToken(token: string): void {
    const control = this.form.controls.bodyText;
    control.setValue(`${control.value}{{${token}}}`);
    control.markAsDirty();
  }

  /** True when saving would silently drop this template back to Pending. */
  get willResetApproval(): boolean {
    return (
      this.isEdit &&
      this.data.template?.whatsAppTemplateStatus === WhatsAppTemplateStatus.Approved &&
      this.form.controls.bodyText.value !== this.data.template.bodyText
    );
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const saved$: Observable<MessageTemplate> =
      this.isEdit && this.data.template
        ? this.templates.update(this.data.template.id, {
            bodyText: raw.bodyText.trim(),
            isActive: raw.isActive,
          })
        : this.templates.create({
            name: raw.name.trim(),
            language: raw.language.trim(),
            category: raw.category,
            whatsAppTemplateName: raw.whatsAppTemplateName.trim(),
            bodyText: raw.bodyText.trim(),
          });

    this.saving = true;
    saved$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Template updated.' : 'Template created — pending review.');
        this.dialogRef.close(true);
      },
      error: () => {
        // ErrorInterceptor toasts it (e.g. 409 for a duplicate WhatsApp name + language).
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

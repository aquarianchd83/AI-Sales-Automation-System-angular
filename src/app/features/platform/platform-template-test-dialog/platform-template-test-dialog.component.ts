import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { DeliveryTestResult } from '../../../core/models/platform.model';
import { PlatformMessageTemplate, renderTemplatePreview } from '../../../core/models/platform-whatsapp.model';
import { PlatformMessageTemplatesService } from '../../../core/services/platform-message-templates.service';

/** Sends one notice template to a number with sample values, so the admin sees exactly what a tenant will. Only an approved template can go. */
@Component({
  selector: 'app-platform-template-test-dialog',
  templateUrl: './platform-template-test-dialog.component.html',
  styles: [
    `
      .full {
        width: 100%;
      }
      .sample {
        margin: 0 0 16px;
        padding: 10px 12px;
        border-radius: 10px;
        background: #e7f6e7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .result {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 16px 0 0;
      }
      .result mat-icon {
        color: var(--mat-sys-primary, #2e7d32);
      }
      .result--fail mat-icon {
        color: var(--mat-sys-error, #b3261e);
      }
    `,
  ],
})
export class PlatformTemplateTestDialogComponent {
  readonly to = this.fb.control('', [Validators.required, Validators.pattern(/^\s*\+[0-9 ()-]{8,20}\s*$/)]);
  sending = false;
  result: DeliveryTestResult | null = null;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly api: PlatformMessageTemplatesService,
    private readonly dialogRef: MatDialogRef<PlatformTemplateTestDialogComponent>,
    @Inject(MAT_DIALOG_DATA) readonly template: PlatformMessageTemplate
  ) {}

  get preview(): string {
    return renderTemplatePreview(this.template.bodyText, this.template.sampleMessage);
  }

  send(): void {
    this.to.markAsTouched();
    if (this.sending || this.to.invalid) {
      return;
    }

    this.sending = true;
    this.result = null;
    this.api
      .test(this.template.id, this.to.value.trim())
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: (result) => (this.result = result),
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}

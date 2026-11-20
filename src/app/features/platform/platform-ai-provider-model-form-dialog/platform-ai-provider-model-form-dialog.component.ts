import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { AI_MODEL_TYPES, AI_PROVIDER_NAMES, AiProviderModel } from '../../../core/models/platform.model';
import { AiProviderModelService } from '../../../core/services/ai-provider-model.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface PlatformAiProviderModelFormDialogData {
  model?: AiProviderModel;
  /** Providers already in the catalogue, offered next to the standard ones. */
  providers?: string[];
}

const OTHER = '__other__';

@Component({
  selector: 'app-platform-ai-provider-model-form-dialog',
  templateUrl: './platform-ai-provider-model-form-dialog.component.html',
  styleUrls: ['./platform-ai-provider-model-form-dialog.component.scss'],
})
export class PlatformAiProviderModelFormDialogComponent {
  readonly isEdit = !!this.data.model;
  readonly modelTypes = AI_MODEL_TYPES;
  readonly other = OTHER;
  readonly providerOptions = Array.from(new Set([...AI_PROVIDER_NAMES, ...(this.data.providers ?? []), ...(this.data.model ? [this.data.model.provider] : [])]));
  saving = false;

  readonly form = this.fb.nonNullable.group({
    providerChoice: [this.data.model?.provider ?? 'Anthropic', Validators.required],
    customProvider: [''],
    modelType: [this.data.model?.modelType ?? 'Chat', Validators.required],
    displayName: [this.data.model?.displayName ?? '', [Validators.required, Validators.maxLength(200)]],
    modelId: [this.data.model?.modelId ?? '', [Validators.required, Validators.maxLength(200)]],
    contextWindowTokens: [this.data.model?.contextWindowTokens ?? (null as number | null), [Validators.min(1)]],
    maxOutputTokens: [this.data.model?.maxOutputTokens ?? (null as number | null), [Validators.min(1)]],
    inputPricePer1MUsd: [this.data.model?.inputPricePer1MUsd ?? (null as number | null), [Validators.min(0)]],
    outputPricePer1MUsd: [this.data.model?.outputPricePer1MUsd ?? (null as number | null), [Validators.min(0)]],
    description: [this.data.model?.description ?? '', [Validators.maxLength(1000)]],
    isActive: [this.data.model?.isActive ?? true],
    isDefault: [this.data.model?.isDefault ?? false],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly models: AiProviderModelService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformAiProviderModelFormDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformAiProviderModelFormDialogData
  ) {}

  get usingCustomProvider(): boolean {
    return this.form.controls.providerChoice.value === OTHER;
  }

  save(): void {
    const v = this.form.getRawValue();
    const provider = (this.usingCustomProvider ? v.customProvider : v.providerChoice).trim();
    if (this.form.invalid || !provider || provider.length > 50 || this.saving) {
      this.form.markAllAsTouched();
      if (this.usingCustomProvider) {
        this.form.controls.customProvider.setErrors({ required: true });
      }
      return;
    }

    const request = {
      provider,
      displayName: v.displayName.trim(),
      modelId: v.modelId.trim(),
      modelType: v.modelType as AiProviderModel['modelType'],
      contextWindowTokens: v.contextWindowTokens,
      maxOutputTokens: v.maxOutputTokens,
      inputPricePer1MUsd: v.inputPricePer1MUsd,
      outputPricePer1MUsd: v.outputPricePer1MUsd,
      description: v.description.trim() || null,
      isActive: v.isActive,
      isDefault: v.isDefault,
    };

    this.saving = true;
    const call = this.isEdit ? this.models.update(this.data.model!.id, request) : this.models.create(request);
    call.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Model updated.' : 'Model added.');
        this.dialogRef.close(true);
      },
      error: () => {
        /* ErrorInterceptor toasts it; keep the dialog open */
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { AI_MODEL_TYPES, AiProviderModel } from '../../../core/models/platform.model';
import { AiProviderModelService } from '../../../core/services/ai-provider-model.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformAiProviderModelFormDialogComponent } from '../platform-ai-provider-model-form-dialog/platform-ai-provider-model-form-dialog.component';
import { PlatformAiProviderModelCompareDialogComponent } from '../platform-ai-provider-model-compare-dialog/platform-ai-provider-model-compare-dialog.component';

@Component({
  selector: 'app-platform-ai-provider-models',
  templateUrl: './platform-ai-provider-models.component.html',
  styleUrls: ['./platform-ai-provider-models.component.scss'],
})
export class PlatformAiProviderModelsComponent implements OnInit {
  readonly modelTypes = AI_MODEL_TYPES;
  readonly columns = ['provider', 'model', 'modelId', 'type', 'tier', 'context', 'price', 'active', 'createdAt', 'actions'];

  models: AiProviderModel[] = [];
  loading = true;

  search = '';
  providerFilter = '';
  typeFilter = '';
  statusFilter = '';

  constructor(
    private readonly modelService: AiProviderModelService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  /** Providers present in the catalogue, for the filter dropdown. */
  get providers(): string[] {
    return Array.from(new Set(this.models.map((m) => m.provider))).sort();
  }

  /** Search, provider, type and status filters, applied to what the API returned. */
  get filtered(): AiProviderModel[] {
    const term = this.search.trim().toLowerCase();
    return this.models.filter(
      (m) =>
        (!this.providerFilter || m.provider === this.providerFilter) &&
        (!this.typeFilter || m.modelType === this.typeFilter) &&
        (!this.statusFilter || (this.statusFilter === 'active') === m.isActive) &&
        (!term || m.displayName.toLowerCase().includes(term) || m.modelId.toLowerCase().includes(term))
    );
  }

  compare(): void {
    this.dialog.open(PlatformAiProviderModelCompareDialogComponent, { data: { models: this.models }, width: '1000px', maxWidth: '96vw' });
  }

  create(): void {
    this.openForm();
  }

  edit(model: AiProviderModel): void {
    this.openForm(model);
  }

  formatTokens(value: number | null): string {
    if (value == null) {
      return '–';
    }
    return value >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}K` : `${value}`;
  }

  toggleActive(model: AiProviderModel): void {
    const request = {
      provider: model.provider,
      displayName: model.displayName,
      modelId: model.modelId,
      modelType: model.modelType,
      contextWindowTokens: model.contextWindowTokens,
      maxOutputTokens: model.maxOutputTokens,
      inputPricePer1MUsd: model.inputPricePer1MUsd,
      outputPricePer1MUsd: model.outputPricePer1MUsd,
      costTier: model.costTier,
      bestFor: model.bestFor,
      description: model.description,
      isActive: !model.isActive,
      isDefault: model.isDefault,
    };
    this.modelService.update(model.id, request).subscribe({
      next: (saved) => {
        model.isActive = saved.isActive;
        this.notify.success(`${model.displayName} ${saved.isActive ? 'activated' : 'deactivated'}.`);
      },
      error: () => this.load(),
    });
  }

  delete(model: AiProviderModel): void {
    const data: ConfirmDialogData = {
      title: 'Delete model?',
      message: `"${model.displayName}" (${model.modelId}) will be removed from the catalogue. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.modelService.delete(model.id).subscribe(() => {
          this.notify.success('Model deleted.');
          this.load();
        });
      });
  }

  private openForm(model?: AiProviderModel): void {
    this.dialog
      .open(PlatformAiProviderModelFormDialogComponent, { data: { model, providers: this.providers }, width: '640px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  private load(): void {
    this.loading = true;
    this.modelService.getAll().subscribe({
      next: (models) => {
        this.models = models;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }
}

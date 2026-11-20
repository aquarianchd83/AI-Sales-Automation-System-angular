import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { AI_MODEL_TASKS, AiModelCostTier, AiProviderModel } from '../../../core/models/platform.model';

export interface PlatformAiProviderModelCompareDialogData {
  models: AiProviderModel[];
}

interface CompareRow {
  label: string;
  /** One cell per provider column: the models recommended for the task, cheapest first. */
  cells: AiProviderModel[][];
}

const TIER_ORDER: Record<AiModelCostTier, number> = { Cheap: 0, Average: 1, Expensive: 2 };
const PROVIDER_ORDER = ['Anthropic', 'OpenAI', 'Google'];

/** Compare models by task: for each task, the model each provider recommends ("Best for" on the model), with its cost tier and price. */
@Component({
  selector: 'app-platform-ai-provider-model-compare-dialog',
  templateUrl: './platform-ai-provider-model-compare-dialog.component.html',
  styleUrls: ['./platform-ai-provider-model-compare-dialog.component.scss'],
})
export class PlatformAiProviderModelCompareDialogComponent {
  readonly providers: string[];
  readonly rows: CompareRow[];

  constructor(@Inject(MAT_DIALOG_DATA) data: PlatformAiProviderModelCompareDialogData) {
    // A model that is switched off cannot be used, so it is not recommended here.
    const active = data.models.filter((m) => m.isActive && m.bestFor?.length);
    const names = Array.from(new Set(active.map((m) => m.provider)));
    this.providers = [...names].sort((a, b) => this.providerRank(a) - this.providerRank(b) || a.localeCompare(b));

    this.rows = AI_MODEL_TASKS.map((task) => ({
      label: task.label,
      cells: this.providers.map((provider) =>
        active
          .filter((m) => m.provider === provider && m.bestFor.includes(task.key))
          .sort((a, b) => TIER_ORDER[a.costTier] - TIER_ORDER[b.costTier] || (a.outputPricePer1MUsd ?? 0) - (b.outputPricePer1MUsd ?? 0))
      ),
    }));
  }

  price(model: AiProviderModel): string {
    if (model.inputPricePer1MUsd == null && model.outputPricePer1MUsd == null) {
      return '–';
    }
    const part = (v: number | null) => (v == null ? '–' : `$${v}`);
    return `${part(model.inputPricePer1MUsd)} / ${part(model.outputPricePer1MUsd)}`;
  }

  private providerRank(provider: string): number {
    const i = PROVIDER_ORDER.indexOf(provider);
    return i < 0 ? PROVIDER_ORDER.length : i;
  }
}

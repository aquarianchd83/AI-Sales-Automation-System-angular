import { Component, OnInit } from '@angular/core';

import { AiProviderId, AiTaskModelCell, AiTaskModelChoice, AiTaskModelGroup, AiTaskModels } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformAiProvidersService } from '../../../core/services/platform-ai-providers.service';

/** The value of the "Same as chat model" entry: a blank model puts the group back on the provider's chat model. */
export const SAME_AS_CHAT = '';

/**
 * "Model by task" on the AI Providers page. Each group of tasks (customer replies, product knowledge, keywords and rewrites) can run on its own
 * model, per provider: a fast cheap one for replies, an accurate one for documents, the cheapest for keywords. Nothing chosen means the provider's
 * chat model, so the card changes nothing until an operator uses it. Prices come from the AI Provider Charges page, and a model without one is
 * flagged, because a cost with no price is counted as free.
 */
@Component({
  selector: 'app-ai-task-models',
  templateUrl: './ai-task-models.component.html',
  styleUrls: ['./ai-task-models.component.scss'],
})
export class AiTaskModelsComponent implements OnInit {
  readonly sameAsChat = SAME_AS_CHAT;

  groups: AiTaskModelGroup[] = [];
  loading = true;
  failed = false;
  saving = false;

  /** What the operator has picked but not saved yet, by "group/provider". */
  private readonly draft = new Map<string, string>();

  constructor(private readonly api: PlatformAiProvidersService, private readonly notify: NotificationService) {}

  ngOnInit(): void {
    this.load();
  }

  get dirty(): boolean {
    return this.draft.size > 0;
  }

  /** What a select shows: the pending pick, else what is saved ('' for "Same as chat model"). */
  valueOf(group: AiTaskModelGroup, cell: AiTaskModelCell): string {
    const picked = this.draft.get(this.keyOf(group, cell)) ?? cell.selected;
    // A group with no blank entry always shows a real model, even before one has been saved.
    return picked ?? (group.allowDefault ? SAME_AS_CHAT : cell.effectiveModel);
  }

  pick(group: AiTaskModelGroup, cell: AiTaskModelCell, model: string): void {
    const key = this.keyOf(group, cell);
    // Choosing what is already saved is no change.
    if (model === (cell.selected ?? (group.allowDefault ? SAME_AS_CHAT : cell.effectiveModel))) {
      this.draft.delete(key);
    } else {
      this.draft.set(key, model);
    }
  }

  /** The model the group would run on with the pick in place, and its price - the same figures the server shows once saved. */
  shown(group: AiTaskModelGroup, cell: AiTaskModelCell): { model: string; hasPrice: boolean; inputPer1M: number | null; outputPer1M: number | null } {
    const value = this.valueOf(group, cell);
    const model = value === SAME_AS_CHAT ? cell.chatModel : value;
    const option = cell.options.find((o) => o.model === model);
    return { model, hasPrice: option?.hasPrice ?? false, inputPer1M: option?.inputPer1M ?? null, outputPer1M: option?.outputPer1M ?? null };
  }

  /** The default entry ("Same as chat model", or "Default" for lead discovery) names the model it stands for, so the operator sees what "same" means. */
  sameLabel(group: AiTaskModelGroup, cell: AiTaskModelCell): string {
    return `${group.defaultLabel} (${cell.chatModel || 'not set'})`;
  }

  /** Every model that has no price among the current picks - listed above the save button so it is not missed. */
  get unpriced(): string[] {
    const missing = new Set<string>();
    for (const group of this.groups) {
      for (const cell of group.providers) {
        if (!cell.available) {
          continue;
        }
        const shown = this.shown(group, cell);
        if (!shown.hasPrice) {
          missing.add(`${cell.providerLabel} ${shown.model}`);
        }
      }
    }
    return [...missing];
  }

  discard(): void {
    this.draft.clear();
  }

  save(): void {
    if (!this.dirty || this.saving) {
      return;
    }
    const choices: AiTaskModelChoice[] = [...this.draft.entries()].map(([key, model]) => {
      const [group, provider] = key.split('/');
      return { group, provider: provider as AiProviderId, model };
    });

    this.saving = true;
    this.api.updateTaskModels(choices).subscribe({
      next: (result) => {
        this.apply(result);
        this.draft.clear();
        this.saving = false;
        this.notify.success('Model choices saved. They apply from the next request.');
      },
      error: (err) => {
        this.saving = false;
        this.notify.error(err?.error?.message || err?.error?.detail || 'The model choices could not be saved.');
      },
    });
  }

  trackGroup = (_: number, group: AiTaskModelGroup) => group.key;
  trackCell = (_: number, cell: AiTaskModelCell) => cell.provider;

  private load(): void {
    this.api.taskModels().subscribe({
      next: (result) => {
        this.apply(result);
        this.loading = false;
      },
      error: () => {
        this.failed = true;
        this.loading = false;
      },
    });
  }

  private apply(result: AiTaskModels): void {
    this.groups = result.groups;
  }

  private keyOf(group: AiTaskModelGroup, cell: AiTaskModelCell): string {
    return `${group.key}/${cell.provider}`;
  }
}

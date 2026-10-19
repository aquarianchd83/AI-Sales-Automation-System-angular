import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  AiExecution,
  AiPolicy,
  AiProviderId,
  AiProviderPanel,
  AiProviderStatus,
  AiProvidersOverview,
  UpdateAiProviderRequest,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformAiProvidersService } from '../../../core/services/platform-ai-providers.service';

/** What a provider's status means, in a few words. */
export const STATUS_TEXT: Record<AiProviderStatus, string> = {
  Ready: 'Ready',
  Off: 'Switched off',
  NotConfigured: 'No key saved',
  NotVerified: 'Not verified yet',
  Verified: 'Verified',
  Failed: 'Check failed',
};

/** The product-knowledge tasks, by the name a platform admin would use. */
export const TASK_TEXT: Record<string, string> = {
  DocumentAnalysis: 'Document and PDF analysis',
  ProductInfoExtraction: 'Product information extraction',
  KnowledgeConsolidation: 'Knowledge consolidation',
  GroundedQuestionAnswering: 'Question answering from sources',
  CustomQuestionAnswering: 'Tenant-created questions',
  QuestionnaireGeneration: 'Questionnaire generation',
  BenefitAnalysis: 'Benefits and customer value',
  MissingInformationDetection: 'Missing-information detection',
  ConflictIdentification: 'Conflict identification',
  SuggestedAnswerGeneration: 'Suggested answers',
  KnowledgeDraft: 'Draft knowledge file',
  ScannedDocumentReading: 'Reading scanned pages (needs an image-capable model)',
  ConnectionCheck: 'Connection check',
  Benchmark: 'Accuracy test',
};

/** Per-provider form state: what is typed on the card before it is saved. */
interface ProviderDraft {
  apiKey: FormControl<string>;
  model: FormControl<string>;
  inputPrice: FormControl<number | null>;
  outputPrice: FormControl<number | null>;
}

/**
 * The AI providers section of the Integrations page: one card each for the Simulator, ChatGPT, Claude and Gemini. Each card switches the
 * provider on or off, takes a new key (write-only - only a masked hint is ever shown), sets the model and the price per million tokens,
 * verifies the connection with a real call, and runs a small accuracy test so the admin can compare providers on measured numbers rather
 * than claims. Below the cards: the fallback policy, the scanned-document switch, and the log of every AI call. Each action saves at once;
 * nothing here waits for the page's own Save button.
 */
@Component({
  selector: 'app-platform-ai-providers',
  templateUrl: './platform-ai-providers.component.html',
  styleUrls: ['./platform-ai-providers.component.scss'],
})
export class PlatformAiProvidersComponent implements OnInit {
  readonly statusText = STATUS_TEXT;
  readonly executionColumns = ['when', 'task', 'provider', 'mode', 'status', 'duration', 'tokens', 'cost', 'error'];

  overview: AiProvidersOverview | null = null;
  loading = true;
  loadFailed = false;

  /** Which card has an action running, and what it is ("enabled", "key", "model", "price", "verify", "benchmark"). */
  busy: Partial<Record<AiProviderId, string>> = {};
  checkMessages: Partial<Record<AiProviderId, { success: boolean; message: string }>> = {};
  readonly drafts: Partial<Record<AiProviderId, ProviderDraft>> = {};
  readonly expandedCases = new Set<AiProviderId>();
  readonly expandedCapabilities = new Set<AiProviderId>();

  // Policy, edited as a whole and saved with one button.
  policyFallback = false;
  policyOrder: AiProviderId[] = [];
  policyScenario = 'Success';
  policyScanned = false;
  readonly policyMaxCost = new FormControl<number | null>(0.5);
  savingPolicy = false;

  executions: PagedResult<AiExecution> = emptyPage<AiExecution>();
  executionsLoading = false;
  private executionPage = 1;
  private readonly executionPageSize = 10;

  constructor(
    private readonly providers: PlatformAiProvidersService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadExecutions();
  }

  get realProviders(): AiProviderPanel[] {
    return (this.overview?.providers ?? []).filter((p) => !p.isSimulator);
  }

  get simulator(): AiProviderPanel | undefined {
    return this.overview?.providers.find((p) => p.isSimulator);
  }

  /** The product-knowledge engine's current engine, in words. */
  get chosenText(): string {
    if (!this.overview) {
      return '';
    }
    return this.overview.chosenMode === 'Api' ? this.nameOf(this.overview.chosenProvider) : 'the Simulator';
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.providers
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (overview) => this.apply(overview),
        error: () => (this.loadFailed = true),
      });
  }

  draft(provider: AiProviderId): ProviderDraft {
    return this.drafts[provider]!;
  }

  statusClass(status: AiProviderStatus): string {
    return `status status--${status.toLowerCase()}`;
  }

  taskName(task: string): string {
    return TASK_TEXT[task] ?? task;
  }

  nameOf(provider: string): string {
    switch (provider) {
      case 'OpenAI':
        return 'ChatGPT';
      case 'Anthropic':
        return 'Claude';
      case 'Google':
        return 'Gemini';
      default:
        return provider;
    }
  }

  verifiedCount(panel: AiProviderPanel): number {
    return panel.capabilities.filter((c) => c.verified).length;
  }

  toggle(set: Set<AiProviderId>, provider: AiProviderId): void {
    if (!set.delete(provider)) {
      set.add(provider);
    }
  }

  // ----- provider actions --------------------------------------------------------------------------------------------------------

  setEnabled(panel: AiProviderPanel, enabled: boolean): void {
    this.save(panel.provider, 'enabled', { enabled }, enabled ? `${panel.displayName} is switched on.` : `${panel.displayName} is switched off.`);
  }

  saveKey(panel: AiProviderPanel): void {
    const key = this.draft(panel.provider).apiKey.value.trim();
    if (!key) {
      return;
    }
    this.save(panel.provider, 'key', { apiKey: key }, `${panel.displayName} key saved. Verify the connection to check it.`, () =>
      this.draft(panel.provider).apiKey.setValue('')
    );
  }

  saveModel(panel: AiProviderPanel): void {
    const model = this.draft(panel.provider).model.value.trim();
    if (!model || model === panel.model) {
      return;
    }
    this.save(panel.provider, 'model', { model }, `${panel.displayName} model saved. Verify the connection to check it.`);
  }

  savePrice(panel: AiProviderPanel): void {
    const draft = this.draft(panel.provider);
    const input = draft.inputPrice.value;
    const output = draft.outputPrice.value;
    if (input === null || output === null || input < 0 || output < 0) {
      this.notify.error('Enter both prices as 0 or more.');
      return;
    }
    this.save(panel.provider, 'price', { inputPer1MUsd: input, outputPer1MUsd: output }, `${panel.displayName} prices saved.`);
  }

  verify(panel: AiProviderPanel): void {
    if (this.busy[panel.provider]) {
      return;
    }
    this.busy = { ...this.busy, [panel.provider]: 'verify' };
    this.providers
      .verify(panel.provider)
      .pipe(finalize(() => this.clearBusy(panel.provider)))
      .subscribe((result) => {
        this.checkMessages = { ...this.checkMessages, [panel.provider]: { success: result.success, message: result.message } };
        this.replace(result.provider);
        this.loadExecutions();
      });
  }

  benchmark(panel: AiProviderPanel): void {
    if (this.busy[panel.provider]) {
      return;
    }
    this.busy = { ...this.busy, [panel.provider]: 'benchmark' };
    this.providers
      .benchmark(panel.provider)
      .pipe(finalize(() => this.clearBusy(panel.provider)))
      .subscribe((updated) => {
        this.replace(updated);
        this.expandedCases.add(panel.provider);
        this.notify.success(`${panel.displayName}: ${updated.benchmark?.passed ?? 0} of ${updated.benchmark?.total ?? 0} test questions passed.`);
        this.loadExecutions();
      });
  }

  // ----- policy --------------------------------------------------------------------------------------------------------------------

  /** Providers that can be in the fallback order but are not yet. */
  get fallbackCandidates(): AiProviderId[] {
    return (['OpenAI', 'Anthropic', 'Google'] as AiProviderId[]).filter((p) => !this.policyOrder.includes(p));
  }

  moveUp(index: number): void {
    if (index <= 0) {
      return;
    }
    const order = [...this.policyOrder];
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    this.policyOrder = order;
  }

  removeFromOrder(index: number): void {
    this.policyOrder = this.policyOrder.filter((_, i) => i !== index);
  }

  addToOrder(provider: AiProviderId): void {
    this.policyOrder = [...this.policyOrder, provider];
  }

  savePolicy(): void {
    const maxCost = this.policyMaxCost.value;
    if (maxCost === null || maxCost < 0) {
      this.notify.error('Enter a cost limit of 0 or more (0 means no limit).');
      return;
    }

    this.savingPolicy = true;
    this.providers
      .updatePolicy({
        fallbackEnabled: this.policyFallback,
        fallbackOrder: this.policyOrder,
        simulatorScenario: this.policyScenario,
        scannedDocumentsViaAi: this.policyScanned,
        maxCostPerCallUsd: maxCost,
      })
      .pipe(finalize(() => (this.savingPolicy = false)))
      .subscribe((policy) => {
        this.applyPolicy(policy);
        if (this.overview) {
          this.overview = { ...this.overview, policy };
        }
        this.notify.success('AI policy saved.');
      });
  }

  // ----- execution log -------------------------------------------------------------------------------------------------------------

  loadExecutions(): void {
    this.executionsLoading = true;
    this.providers
      .executions(this.executionPage, this.executionPageSize)
      .pipe(finalize(() => (this.executionsLoading = false)))
      .subscribe({ next: (page) => (this.executions = page) });
  }

  onExecutionsPage(event: PageEvent): void {
    this.executionPage = event.pageIndex + 1;
    this.loadExecutions();
  }

  // ----- internals -----------------------------------------------------------------------------------------------------------------

  private save(provider: AiProviderId, what: string, request: UpdateAiProviderRequest, message: string, after?: () => void): void {
    if (this.busy[provider]) {
      return;
    }
    this.busy = { ...this.busy, [provider]: what };
    const call: Observable<AiProviderPanel> = this.providers.update(provider, request);
    call.pipe(finalize(() => this.clearBusy(provider))).subscribe({
      next: (panel) => {
        this.replace(panel);
        after?.();
        this.notify.success(message);
      },
      // A refused change (validation, network) leaves the card as it was; reload so a toggle never shows a state that was not saved.
      error: () => this.load(),
    });
  }

  private clearBusy(provider: AiProviderId): void {
    const next = { ...this.busy };
    delete next[provider];
    this.busy = next;
  }

  private apply(overview: AiProvidersOverview): void {
    this.overview = overview;
    for (const panel of overview.providers.filter((p) => !p.isSimulator)) {
      this.drafts[panel.provider] = {
        apiKey: new FormControl('', { nonNullable: true }),
        model: new FormControl(panel.model ?? '', { nonNullable: true }),
        inputPrice: new FormControl<number | null>(panel.inputPer1MUsd),
        outputPrice: new FormControl<number | null>(panel.outputPer1MUsd),
      };
    }
    this.applyPolicy(overview.policy);
  }

  private replace(panel: AiProviderPanel): void {
    if (!this.overview) {
      return;
    }
    this.overview = { ...this.overview, providers: this.overview.providers.map((p) => (p.provider === panel.provider ? panel : p)) };
    const draft = this.drafts[panel.provider];
    if (draft) {
      draft.model.setValue(panel.model ?? '');
      draft.inputPrice.setValue(panel.inputPer1MUsd);
      draft.outputPrice.setValue(panel.outputPer1MUsd);
    }
  }

  private applyPolicy(policy: AiPolicy): void {
    this.policyFallback = policy.fallbackEnabled;
    this.policyOrder = [...policy.fallbackOrder];
    this.policyScenario = policy.simulatorScenario;
    this.policyScanned = policy.scannedDocumentsViaAi;
    this.policyMaxCost.setValue(policy.maxCostPerCallUsd);
  }
}

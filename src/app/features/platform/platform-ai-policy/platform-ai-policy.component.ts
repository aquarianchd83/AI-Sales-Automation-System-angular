import { Component, Input, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { finalize } from 'rxjs/operators';

import { AI_TASK_TEXT, aiProviderName } from '../../../core/models/ai-provider-text';
import { PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { AiExecution, AiPolicy, AiProviderId } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformAiProvidersService } from '../../../core/services/platform-ai-providers.service';

/**
 * The feature-level AI settings on the Integrations page, below the engine choices: the product-knowledge AI policy (fallback, the cost limit per
 * call, what the simulator returns) and the log of every AI call. Whether scanned pages are read with AI is that task group's own Off switch above. The providers themselves - On/Off,
 * key, model, prices, Verify and the accuracy test - are on Configuration > AI Providers, the one place they are kept.
 */
@Component({
  selector: 'app-platform-ai-policy',
  templateUrl: './platform-ai-policy.component.html',
  styleUrls: ['./platform-ai-policy.component.scss'],
})
export class PlatformAiPolicyComponent implements OnInit {
  /** Which part to show: the policy card, the call log, or both. */
  @Input() show: 'all' | 'policy' | 'calls' = 'all';

  readonly executionColumns = ['when', 'task', 'provider', 'mode', 'status', 'duration', 'tokens', 'cost', 'error'];
  readonly nameOf = aiProviderName;

  loading = true;
  loadFailed = false;
  scenarios: string[] = [];

  // Policy, edited as a whole and saved with one button.
  policyFallback = false;
  policyOrder: AiProviderId[] = [];
  policyScenario = 'Success';
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

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.providers
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (overview) => {
          this.scenarios = overview.policy.scenarios;
          this.applyPolicy(overview.policy);
        },
        error: () => (this.loadFailed = true),
      });
  }

  taskName(task: string): string {
    return AI_TASK_TEXT[task] ?? task;
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
        maxCostPerCallUsd: maxCost,
      })
      .pipe(finalize(() => (this.savingPolicy = false)))
      .subscribe((policy) => {
        this.applyPolicy(policy);
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

  private applyPolicy(policy: AiPolicy): void {
    this.policyFallback = policy.fallbackEnabled;
    this.policyOrder = [...policy.fallbackOrder];
    this.policyScenario = policy.simulatorScenario;
    this.policyMaxCost.setValue(policy.maxCostPerCallUsd);
  }
}

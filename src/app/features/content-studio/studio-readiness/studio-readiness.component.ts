import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  ClaimCheckResult,
  ClaimVerdict,
  ContentReadinessStatus,
  ContentTypeReadiness,
  KnowledgeGap,
  KnowledgeGapReason,
  KnowledgeReadiness,
  RequirementState,
} from '../../../core/models/content-studio.model';
import { AppRole } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';

export const STATUS_LABELS: Record<ContentReadinessStatus, string> = {
  Ready: 'Ready',
  NeedsConfirmation: 'Almost - needs confirming',
  NotReady: 'Not ready yet',
};

export const REQUIREMENT_LABELS: Record<RequirementState, string> = {
  Met: 'Done',
  NeedsConfirmation: 'Needs confirming',
  NeedsEvidence: 'Needs proof',
  Outdated: 'Out of date',
  Expired: 'Out of date',
  Missing: 'Missing',
  Skipped: 'Skipped',
};

export const REASON_LABELS: Record<KnowledgeGapReason, string> = {
  Missing: 'We need this',
  Unknown: 'You said you did not know',
  NeedsHelp: 'You asked for help',
  NeedsConfirmation: 'Waiting to be confirmed',
  NeedsEvidence: 'Needs proof',
  Outdated: 'Needs checking again',
  Expired: 'Out of date',
};

export const VERDICT_LABELS: Record<ClaimVerdict, string> = {
  Supported: 'Backed by a verified fact',
  Unverified: 'Not verified yet',
  Unsupported: 'Nothing backs this',
};

/**
 * What the studio knows about the business and what it could safely make from it. Each kind of content has a readiness that is
 * explained, not just scored: which facts count, which are still only the tenant's word, which lack proof or have gone out of date.
 * Under it, the open questions - each a simple follow-up with the reason it is asked - answered, skipped or put off right here, so
 * nobody leaves the page to improve the score. Anyone can use it; only an Admin can verify a fact, so only an Admin sees the verify
 * buttons. A small tool checks any sentence against the verified facts.
 */
@Component({
  selector: 'app-studio-readiness',
  templateUrl: './studio-readiness.component.html',
  styleUrls: ['./studio-readiness.component.scss'],
})
export class StudioReadinessComponent implements OnInit {
  readonly statusLabels = STATUS_LABELS;
  readonly requirementLabels = REQUIREMENT_LABELS;
  readonly reasonLabels = REASON_LABELS;
  readonly verdictLabels = VERDICT_LABELS;
  readonly maxAnswer = 1000;
  readonly maxEvidence = 500;
  readonly maxContext = 300;

  readonly answer = new FormControl('', { nonNullable: true });
  readonly evidence = new FormControl('', { nonNullable: true });
  readonly context = new FormControl('', { nonNullable: true });
  readonly claims = new FormControl('', { nonNullable: true });

  readonly canVerify = this.auth.hasAnyRole([AppRole.Admin]);

  readiness: KnowledgeReadiness | null = null;
  loading = true;
  busy = false;
  checking = false;

  /** The gap whose answer form is open, and the content types whose breakdown is open. */
  answering: string | null = null;
  readonly expanded = new Set<string>();
  showDeferred = false;
  claimsOpen = false;
  claimResult: ClaimCheckResult | null = null;

  constructor(
    private readonly studio: ContentStudioService,
    private readonly notify: NotificationService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.studio
      .getReadiness()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (readiness) => (this.readiness = readiness) });
  }

  get openGaps(): KnowledgeGap[] {
    return (this.readiness?.gaps ?? []).filter((g) => g.state === 'Open');
  }

  get deferredGaps(): KnowledgeGap[] {
    return (this.readiness?.gaps ?? []).filter((g) => g.state === 'Deferred');
  }

  statusClass(type: ContentTypeReadiness): string {
    return `badge badge--${type.status.toLowerCase()}`;
  }

  stateClass(state: RequirementState): string {
    return `badge badge--req-${state.toLowerCase()}`;
  }

  /** A gap's examples: the rule gives one per kind of business, separated by a bar. */
  examplesOf(gap: KnowledgeGap): string[] {
    return (gap.example ?? '')
      .split('|')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }

  toggle(key: string): void {
    if (!this.expanded.delete(key)) {
      this.expanded.add(key);
    }
  }

  /** Where the minimum score sits on the meter, as a percentage of its width. */
  threshold(type: ContentTypeReadiness): number {
    return Math.min(100, Math.max(0, type.minScore));
  }

  // ----- answering a follow-up --------------------------------------------------------------------------------------------------

  /** Opens the answer form for a gap, in place. Only one is open at a time. */
  startAnswer(gap: KnowledgeGap): void {
    this.answering = gap.key;
    this.answer.setValue('');
    this.evidence.setValue('');
    this.context.setValue('');
  }

  cancelAnswer(): void {
    this.answering = null;
  }

  /** When the gap only lacks proof, the answer is the proof: there is nothing to repeat. */
  proofOnly(gap: KnowledgeGap): boolean {
    return gap.reason === 'NeedsEvidence';
  }

  canSubmit(gap: KnowledgeGap): boolean {
    const answer = this.answer.value.trim();
    const evidence = this.evidence.value.trim();
    if (this.proofOnly(gap)) {
      return evidence.length > 0;
    }
    return answer.length > 0 && (!gap.requiresEvidence || evidence.length > 0);
  }

  submit(gap: KnowledgeGap): void {
    if (!this.canSubmit(gap) || this.busy) {
      return;
    }

    this.run(
      this.studio.answerGap(gap.key, {
        answer: this.proofOnly(gap) ? '' : this.answer.value.trim(),
        evidence: this.evidence.value.trim() || null,
        context: this.context.value.trim() || null,
      }),
      this.proofOnly(gap) ? 'Thanks - the proof is saved.' : 'Thanks. It is saved, and waits for an Admin to confirm it.'
    );
  }

  skip(gap: KnowledgeGap): void {
    if (this.busy) {
      return;
    }
    this.run(this.studio.skipGap(gap.key), 'Skipped. It no longer counts against you.');
  }

  later(gap: KnowledgeGap): void {
    if (this.busy) {
      return;
    }
    this.run(this.studio.deferGap(gap.key, null), "We'll ask again in a week.");
  }

  reopen(gap: KnowledgeGap): void {
    if (this.busy) {
      return;
    }
    this.run(this.studio.reopenGap(gap.key), 'Back on your list.');
  }

  /** Admin: confirm the facts that fill this gap, in place. A fact that was confirmed before and went stale is confirmed again. */
  verify(gap: KnowledgeGap): void {
    if (!this.canVerify || this.busy || !gap.factsToConfirm.length) {
      return;
    }

    const again = gap.reason === 'Expired' || gap.reason === 'Outdated';
    this.busy = true;
    forkJoin(gap.factsToConfirm.map((id) => (again ? this.studio.verifyFact(id, true) : this.studio.verifyFact(id))))
      .subscribe({
        next: () => {
          this.notify.success(again ? 'Confirmed again.' : 'Marked as verified.');
          this.busy = false;
          this.reload();
        },
        error: () => (this.busy = false),
      });
  }

  // ----- checking a sentence ----------------------------------------------------------------------------------------------------

  /** One claim per line. */
  get claimLines(): string[] {
    return this.claims.value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  checkClaims(): void {
    const lines = this.claimLines;
    if (!lines.length || this.checking) {
      return;
    }

    this.checking = true;
    this.studio
      .checkClaims(lines)
      .pipe(finalize(() => (this.checking = false)))
      .subscribe({ next: (result) => (this.claimResult = result) });
  }

  verdictClass(verdict: ClaimVerdict): string {
    return `badge badge--claim-${verdict.toLowerCase()}`;
  }

  // ----- internals ----------------------------------------------------------------------------------------------------------------

  private run(request: ReturnType<ContentStudioService['skipGap']>, message: string): void {
    this.busy = true;
    request.pipe(finalize(() => (this.busy = false))).subscribe((readiness) => {
      this.readiness = readiness;
      this.answering = null;
      this.notify.success(message);
    });
  }

  private reload(): void {
    this.studio.getReadiness().subscribe({ next: (readiness) => (this.readiness = readiness) });
  }
}

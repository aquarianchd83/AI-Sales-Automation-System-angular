import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, timer } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  DraftRun,
  FeatureBenefit,
  KnowledgeAnswer,
  KnowledgeAnswersOverview,
  KnowledgeConfidence,
  KnowledgeQuestion,
} from '../../../core/models/product-answers.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ProductAnswersService } from '../../../core/services/product-answers.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** How often the screen refreshes while a drafting run is going. */
export const POLL_MS = 4000;

/** The id of the "Features and benefits" entry in the list, which is not a question. */
export const FEATURES = 'features';

export const CONFIDENCE_TEXT: Record<KnowledgeConfidence, string> = {
  High: 'High confidence',
  Medium: 'Medium confidence',
  Low: 'Low confidence',
  NoEvidence: 'No supporting evidence',
};

const CONFIDENCE_HELP: Record<KnowledgeConfidence, string> = {
  High: 'A source states this directly.',
  Medium: 'Supported by your sources, but it needed interpreting or combining passages.',
  Low: 'Partly supported only - a figure is unproven, sources disagree, or little of it is covered.',
  NoEvidence: 'Your sources do not answer this.',
};

/**
 * What the AI found in the tenant's sources, question by question, with its working shown: the quotations that back each answer (checked
 * against the real text), how strong that evidence is, what is unproven, and where sources disagree. Nothing here is approved yet - the
 * confidence is about the evidence, the status is about the tenant, and a High answer is still pending until they act. The list stays on the
 * left and the chosen question opens on the right, so the tenant never leaves the page.
 */
@Component({
  selector: 'app-product-answers',
  templateUrl: './product-answers.component.html',
  styleUrls: ['./product-answers.component.scss'],
})
export class ProductAnswersComponent implements OnInit, OnDestroy {
  readonly confidenceText = CONFIDENCE_TEXT;
  readonly featuresId = FEATURES;

  overview: KnowledgeAnswersOverview | null = null;
  loading = true;
  loadFailed = false;

  selectedId: string | null = null;
  starting = false;
  asking = false;
  busy: Record<string, boolean> = {};
  readonly expanded = new Set<string>();
  readonly question = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(500)] });

  private poll: Subscription | null = null;
  private wasRunning = false;

  constructor(
    private readonly answers: ProductAnswersService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
  }

  get questions(): KnowledgeQuestion[] {
    return this.overview?.questions ?? [];
  }

  get features(): FeatureBenefit[] {
    return this.overview?.features ?? [];
  }

  get selected(): KnowledgeQuestion | null {
    return this.questions.find((q) => q.id === this.selectedId) ?? null;
  }

  get run(): DraftRun | null {
    return this.overview?.run ?? null;
  }

  get running(): boolean {
    return this.run?.status === 'Queued' || this.run?.status === 'Running';
  }

  get progress(): number {
    return this.run && this.run.total > 0 ? Math.round((100 * this.run.done) / this.run.total) : 0;
  }

  get canDraft(): boolean {
    return !!this.overview && this.overview.aiMode !== 'Off' && this.overview.readySources > 0 && !this.running && !this.starting;
  }

  get canAsk(): boolean {
    return !!this.overview && this.overview.aiMode !== 'Off' && this.overview.customQuestions < this.overview.maxCustomQuestions;
  }

  /** How many questions have an answer the evidence supports (anything above "no evidence"). */
  get answered(): number {
    return this.questions.filter((q) => q.answer && q.answer.confidence !== 'NoEvidence').length;
  }

  chipClass(confidence: string): string {
    return `chip chip--${confidence.toLowerCase()}`;
  }

  help(confidence: KnowledgeConfidence): string {
    return CONFIDENCE_HELP[confidence];
  }

  statusText(answer: KnowledgeAnswer): string {
    switch (answer.status) {
      case 'VerifiedAndApproved':
        return 'Approved';
      case 'CorrectionRequired':
        return 'Needs correction';
      case 'Rejected':
        return 'Rejected';
      case 'InformationNotAvailable':
        return 'Information not available';
      default:
        return 'Waiting for your check';
    }
  }

  toggle(id: string): void {
    if (!this.expanded.delete(id)) {
      this.expanded.add(id);
    }
  }

  // ----- loading ---------------------------------------------------------------------------------------------------------------

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.answers
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (overview) => this.apply(overview),
        error: () => (this.loadFailed = true),
      });
  }

  private apply(overview: KnowledgeAnswersOverview): void {
    this.overview = overview;
    if (!this.selectedId || (!this.selected && this.selectedId !== FEATURES)) {
      this.selectedId = overview.questions.find((q) => q.answer)?.id ?? overview.questions[0]?.id ?? null;
    }

    const running = this.running;
    if (this.wasRunning && !running && this.run) {
      if (this.run.status === 'Completed') {
        this.notify.success(`Drafting finished: ${this.run.drafted} answered from your sources, ${this.run.noEvidence} need more information.`);
      } else if (this.run.status === 'Failed') {
        this.notify.error(this.run.error ?? 'Drafting could not finish.');
      }
    }
    this.wasRunning = running;
    this.schedulePoll();
  }

  /** While a run is going the screen refreshes every few seconds, so answers appear as they are drafted; it stops when the run ends. */
  private schedulePoll(): void {
    this.poll?.unsubscribe();
    this.poll = null;
    if (this.running) {
      this.poll = timer(POLL_MS).subscribe(() => this.answers.get().subscribe({ next: (overview) => this.apply(overview) }));
    }
  }

  // ----- actions ---------------------------------------------------------------------------------------------------------------

  draft(): void {
    if (!this.canDraft) {
      return;
    }
    this.starting = true;
    this.answers
      .startDraft()
      .pipe(finalize(() => (this.starting = false)))
      .subscribe({
        next: (run) => {
          this.wasRunning = true;
          if (this.overview) {
            this.overview = { ...this.overview, run };
          }
          this.schedulePoll();
        },
        // ErrorInterceptor shows the reason (nothing read yet, switched off).
        error: () => undefined,
      });
  }

  redraft(question: KnowledgeQuestion): void {
    if (this.busy[question.id]) {
      return;
    }
    this.busy = { ...this.busy, [question.id]: true };
    this.answers
      .redraft(question.id)
      .pipe(finalize(() => (this.busy = { ...this.busy, [question.id]: false })))
      .subscribe({
        next: (updated) => {
          this.replace(updated);
          this.notify.success('Here is another suggestion.');
        },
        error: () => undefined,
      });
  }

  ask(): void {
    const text = this.question.value.trim();
    if (this.question.invalid || this.asking || !this.canAsk) {
      this.question.markAsTouched();
      return;
    }
    this.asking = true;
    this.answers
      .ask(text)
      .pipe(finalize(() => (this.asking = false)))
      .subscribe({
        next: (created) => {
          this.question.reset('');
          if (this.overview) {
            this.overview = { ...this.overview, questions: [...this.overview.questions, created], customQuestions: this.overview.customQuestions + 1 };
          }
          this.selectedId = created.id;
        },
        error: () => undefined,
      });
  }

  remove(question: KnowledgeQuestion): void {
    const data: ConfirmDialogData = {
      title: 'Remove this question?',
      message: `"${question.text}" and its answer are removed.`,
      confirmLabel: 'Remove',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.answers.removeQuestion(question.id).subscribe({
          next: () => {
            if (this.overview) {
              this.overview = {
                ...this.overview,
                questions: this.overview.questions.filter((q) => q.id !== question.id),
                customQuestions: Math.max(0, this.overview.customQuestions - 1),
              };
            }
            if (this.selectedId === question.id) {
              this.selectedId = this.questions[0]?.id ?? null;
            }
          },
          error: () => undefined,
        });
      });
  }

  private replace(question: KnowledgeQuestion): void {
    if (this.overview) {
      this.overview = { ...this.overview, questions: this.overview.questions.map((q) => (q.id === question.id ? question : q)) };
    }
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subscription, timer } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  AnswerProgress,
  AnswerRevision,
  DraftRun,
  FeatureBenefit,
  KnowledgeAnswer,
  KnowledgeConflict,
  KnowledgeAnswersOverview,
  KnowledgeConfidence,
  KnowledgeQuestion,
} from '../../../core/models/product-answers.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ProductAnswersService } from '../../../core/services/product-answers.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** How often the screen refreshes while a drafting run is going. */
export const POLL_MS = 4000;

export type AnswerFilter = 'all' | 'waiting' | 'needs' | 'approved' | 'other';

/** The "write it myself" choice among a conflict's values. */
export const OTHER_VALUE = '__other__';

/** Words that make a tenant's own text a price, guarantee, certification or result: they must tick "I have checked this". Mirrors the server's rule. */
const MATERIAL = /(₹|\brs\.?\s?\d|\binr\b|\$|\busd\b|\bprice|\bcost|\bfee\b|\bcharge|\bguarantee|\bwarrant|\bcertif|\bcomplian|\brefund|%|\d\s?x\b)/i;

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

  // The review: filter, and the decision being made on the chosen answer.
  readonly filters: { id: AnswerFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'waiting', label: 'Waiting for you' },
    { id: 'needs', label: 'Needs your input' },
    { id: 'approved', label: 'Approved' },
    { id: 'other', label: 'Other' },
  ];
  filter: AnswerFilter = 'all';
  editing = false;
  rejecting = false;
  readonly editSummary = new FormControl('', { nonNullable: true });
  readonly editDetail = new FormControl('', { nonNullable: true });
  /** The tenant's "I have checked this": for approving a price or weak answer, and for saving their own price or guarantee. */
  readonly confirm = new FormControl(false, { nonNullable: true });
  readonly rejectReason = new FormControl('', { nonNullable: true });
  readonly conflictChoice: Record<string, string> = {};
  readonly conflictOther: Record<string, string> = {};
  readonly otherValue = OTHER_VALUE;
  history: Record<string, AnswerRevision[]> = {};

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

  /** Where the review stands, worked out from what is on screen so it is right after every action. */
  get review(): AnswerProgress {
    const count = { total: this.questions.length, approved: 0, waiting: 0, needsInformation: 0, rejected: 0, unknown: 0, notApplicable: 0 };
    for (const q of this.questions) {
      switch (this.bucket(q)) {
        case 'approved':
          count.approved++;
          break;
        case 'waiting':
          count.waiting++;
          break;
        case 'needs':
          count.needsInformation++;
          break;
        default:
          if (q.answer?.status === 'Rejected') {
            count.rejected++;
          } else if (q.answer?.status === 'NotApplicable') {
            count.notApplicable++;
          } else {
            count.unknown++;
          }
      }
    }
    return count;
  }

  /** Each question is in exactly one bucket. */
  bucket(q: KnowledgeQuestion): AnswerFilter {
    const a = q.answer;
    if (!a) {
      return 'needs';
    }
    switch (a.status) {
      case 'VerifiedAndApproved':
        return 'approved';
      case 'Rejected':
      case 'InformationNotAvailable':
      case 'NotApplicable':
        return 'other';
      case 'CorrectionRequired':
        return 'waiting';
      default:
        return a.confidence === 'NoEvidence' ? 'needs' : 'waiting';
    }
  }

  get visible(): KnowledgeQuestion[] {
    return this.filter === 'all' ? this.questions : this.questions.filter((q) => this.bucket(q) === this.filter);
  }

  countOf(filter: AnswerFilter): number {
    return filter === 'all' ? this.questions.length : this.questions.filter((q) => this.bucket(q) === filter).length;
  }

  get approvedPercent(): number {
    const r = this.review;
    return r.total > 0 ? Math.round((100 * r.approved) / r.total) : 0;
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
      case 'NotApplicable':
        return 'Does not apply';
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

  select(id: string): void {
    this.selectedId = id;
    this.resetEditors();
  }

  private resetEditors(): void {
    this.editing = false;
    this.rejecting = false;
    this.confirm.setValue(false);
    this.rejectReason.setValue('');
    this.editSummary.setValue('');
    this.editDetail.setValue('');
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

  // ----- the tenant's decisions --------------------------------------------------------------------------------------------------

  /** Why "I have checked this" must be ticked before approving, or null when it need not be. Mirrors the server's rule. */
  needsConfirmation(answer: KnowledgeAnswer): string | null {
    if (answer.isMaterialClaim) {
      return 'This states a price, guarantee, certification or result, which customers will rely on.';
    }
    if (answer.hasUnsupportedClaim) {
      return 'It contains a figure that none of your sources states.';
    }
    if (answer.confidence === 'Low') {
      return 'The evidence for it is weak.';
    }
    return null;
  }

  openConflicts(answer: KnowledgeAnswer): KnowledgeConflict[] {
    return answer.conflicts.filter((c) => c.status === 'Open');
  }

  /** An approved answer that must be looked at again: a source it came from changed, or an approved price has lapsed. */
  needsRecheck(answer: KnowledgeAnswer): boolean {
    return (
      answer.status === 'VerifiedAndApproved' &&
      (!!answer.needsRevalidation || (!!answer.reviewDueAt && new Date(answer.reviewDueAt).getTime() < Date.now()))
    );
  }

  recheckReason(answer: KnowledgeAnswer): string {
    return answer.needsRevalidation && answer.revalidationReason
      ? answer.revalidationReason
      : 'You approved this price, guarantee or result a while ago. Confirm it is still true.';
  }

  canApprove(answer: KnowledgeAnswer): boolean {
    return (
      !!answer.summary &&
      !answer.isSimulated &&
      (answer.status !== 'VerifiedAndApproved' || this.needsRecheck(answer)) &&
      this.openConflicts(answer).length === 0 &&
      (this.needsConfirmation(answer) === null || this.confirm.value)
    );
  }

  approve(q: KnowledgeQuestion): void {
    if (q.answer && this.canApprove(q.answer)) {
      const again = this.needsRecheck(q.answer);
      this.act(q, this.answers.approve(q.answer.id, this.confirm.value), again ? 'Confirmed again.' : 'Approved. It is now an answer you have confirmed.');
    }
  }

  startReject(): void {
    this.rejecting = true;
    this.editing = false;
  }

  reject(q: KnowledgeQuestion): void {
    if (q.answer) {
      this.act(q, this.answers.reject(q.answer.id, this.rejectReason.value.trim() || null), 'Rejected. Ask for another suggestion or write the answer yourself.');
    }
  }

  reopen(q: KnowledgeQuestion): void {
    if (q.answer) {
      this.act(q, this.answers.reopen(q.answer.id, null), 'Reopened for correction. The approval stays in the history.');
    }
  }

  markUnknown(q: KnowledgeQuestion): void {
    this.act(q, this.answers.markUnknown(q.id), 'Marked as information you do not have.');
  }

  markNotApplicable(q: KnowledgeQuestion): void {
    this.act(q, this.answers.markNotApplicable(q.id), 'Marked as not applying to your business.');
  }

  startEdit(q: KnowledgeQuestion): void {
    this.editing = true;
    this.rejecting = false;
    this.confirm.setValue(false);
    this.editSummary.setValue(q.answer?.summary ?? '');
    this.editDetail.setValue(q.answer?.detail ?? '');
  }

  cancelEdit(): void {
    this.editing = false;
    this.rejecting = false;
    this.confirm.setValue(false);
  }

  /** True when the tenant's own text states a price, guarantee, certification or result. */
  get editNeedsConfirmation(): boolean {
    return MATERIAL.test(`${this.editSummary.value} ${this.editDetail.value}`);
  }

  get canSaveEdit(): boolean {
    return this.editSummary.value.trim().length >= 3 && (!this.editNeedsConfirmation || this.confirm.value);
  }

  saveEdit(q: KnowledgeQuestion): void {
    if (!this.canSaveEdit) {
      return;
    }
    this.act(q, this.answers.edit(q.id, this.editSummary.value.trim(), this.editDetail.value.trim() || null, this.confirm.value), 'Saved as your answer.');
  }

  conflictValue(c: KnowledgeConflict): string {
    const choice = this.conflictChoice[c.id];
    return choice === OTHER_VALUE ? (this.conflictOther[c.id] ?? '').trim() : choice ?? '';
  }

  resolve(q: KnowledgeQuestion, c: KnowledgeConflict): void {
    const value = this.conflictValue(c);
    if (value) {
      this.act(q, this.answers.resolveConflict(c.id, value, null), `Recorded: ${value}.`);
    }
  }

  toggleHistory(q: KnowledgeQuestion): void {
    const key = 'history-' + q.id;
    if (this.expanded.delete(key)) {
      return;
    }
    this.expanded.add(key);
    this.answers.history(q.id).subscribe({ next: (rows) => (this.history = { ...this.history, [q.id]: rows }), error: () => undefined });
  }

  kindText(kind: AnswerRevision['kind']): string {
    const text: Record<AnswerRevision['kind'], string> = {
      Drafted: 'Drafted from your sources',
      Approved: 'Approved',
      Edited: 'You wrote your own answer',
      InformationProvided: 'You supplied the answer',
      Rejected: 'Rejected',
      MarkedUnknown: 'Marked: you do not have this information',
      MarkedNotApplicable: 'Marked: does not apply',
      Reopened: 'Reopened for correction',
      ConflictResolved: 'You chose between conflicting values',
      SourceChanged: 'A source this answer came from changed or was removed',
    };
    return text[kind];
  }

  /** Runs one decision and shows its result; the answer, the list and the review counts all follow from the updated question. */
  private act(q: KnowledgeQuestion, call: Observable<KnowledgeQuestion>, message: string): void {
    if (this.busy[q.id]) {
      return;
    }
    this.busy = { ...this.busy, [q.id]: true };
    call.pipe(finalize(() => (this.busy = { ...this.busy, [q.id]: false }))).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.resetEditors();
        const { [q.id]: _dropped, ...rest } = this.history;
        this.history = rest;
        this.expanded.delete('history-' + q.id);
        this.notify.success(message);
      },
      // ErrorInterceptor shows why (test data, open conflict, newer version).
      error: () => undefined,
    });
  }

  private replace(question: KnowledgeQuestion): void {
    if (this.overview) {
      this.overview = { ...this.overview, questions: this.overview.questions.map((q) => (q.id === question.id ? question : q)) };
    }
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, finalize, takeUntil } from 'rxjs/operators';

import {
  AnswerMap,
  AnswerRevision,
  QuestionDef,
  QuestionnaireResponseStatus,
  QuestionnaireState,
  SPECIAL_LABELS,
  SpecialKind,
} from '../../../core/models/content-studio.model';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';
import { isAnswered, isSpecial, specialKind, steps as stepsOf, validateForComplete, visibleKeys } from '../../../core/utils/questionnaire-engine';

/** How long after the last change the answers are saved by themselves. */
export const AUTOSAVE_DELAY_MS = 1500;

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * The tenant's questionnaire about its own business, one small group of related questions at a time. The platform decides the
 * questions (by industry); the tenant answers, the screen shows and hides conditional questions as it goes, and answers are saved by
 * themselves a moment after each change - so closing the tab loses nothing and the questionnaire opens again where they stopped.
 * Anything they do not know can be answered "I don't know", "I need help" or "Not applicable" rather than invented. Completing it
 * drafts the business facts the studio will later be allowed to say once someone verifies them. Once completed it reads as a summary,
 * and "Update my answers" starts a fresh round that keeps every answer that still fits (and moves to a newer version).
 */
@Component({
  selector: 'app-studio-questionnaire',
  templateUrl: './studio-questionnaire.component.html',
  styleUrls: ['./studio-questionnaire.component.scss'],
})
export class StudioQuestionnaireComponent implements OnInit, OnDestroy {
  readonly status = QuestionnaireResponseStatus;
  readonly specialLabels = SPECIAL_LABELS;

  state: QuestionnaireState | null = null;
  answers: AnswerMap = {};
  errors: Record<string, string> = {};
  /** Set for the moment after completing, to say what happened to the business facts. */
  completion: { created: number; updated: number; retired: number } | null = null;

  /** The groups of questions, in order, and the one being shown. */
  steps: QuestionDef[][] = [];
  stepIndex = 0;

  loading = true;
  saving = false;
  completing = false;
  restarting = false;
  dirty = false;
  saveStatus: SaveStatus = 'idle';
  savedAt: Date | null = null;
  /** Shown after a first try at completing, so the unanswered mandatory questions stay in view until they are done. */
  showMissing = false;

  historyOpen = false;
  historyLoading = false;
  history: AnswerRevision[] = [];

  private version = 0;
  private queued = false;
  private readonly changed$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly studio: ContentStudioService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.changed$.pipe(debounceTime(AUTOSAVE_DELAY_MS), takeUntil(this.destroy$)).subscribe(() => this.save(true));

    this.studio
      .getQuestionnaire()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (state) => {
          this.apply(state);
          this.resume();
        },
      });
  }

  ngOnDestroy(): void {
    // Leaving the page with something typed but not yet saved: send it now rather than lose it.
    if (this.dirty && this.editable && !this.saving) {
      this.studio.saveAnswers(this.payload()).subscribe({ error: () => undefined });
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  get editable(): boolean {
    return !!this.state?.available && this.state.status === QuestionnaireResponseStatus.InProgress;
  }

  /** The questions on screen: one step while answering, all of them once completed (a summary). */
  get currentStepKeys(): string[] | null {
    if (!this.editable || !this.steps.length) {
      return null;
    }
    return this.steps[this.stepIndex].map((q) => q.key);
  }

  get stepTitle(): string {
    const first = this.steps[this.stepIndex]?.[0];
    return first?.group?.trim() || first?.prompt || '';
  }

  get isFirstStep(): boolean {
    return this.stepIndex === 0;
  }

  get isLastStep(): boolean {
    return this.stepIndex >= this.steps.length - 1;
  }

  /** Required questions that are asked right now, and how many of them have an answer (a "don't know" counts: it never blocks). */
  get progress(): { answered: number; total: number; percent: number } {
    const definition = this.state?.definition;
    if (!definition) {
      return { answered: 0, total: 0, percent: 0 };
    }
    const visible = visibleKeys(definition, this.answers);
    const required = definition.questions.filter((q) => q.required && visible.has(q.key));
    const answered = required.filter((q) => isAnswered(this.answers[q.key])).length;
    return { answered, total: required.length, percent: required.length ? Math.round((answered / required.length) * 100) : 100 };
  }

  /** The mandatory questions still without an answer, each with the step it is on, so one click goes there. */
  get missing(): { question: QuestionDef; step: number }[] {
    const definition = this.state?.definition;
    if (!definition) {
      return [];
    }
    const unanswered = new Set(
      validateForComplete(definition, this.answers)
        .filter((i) => i.message === 'This question needs an answer.')
        .map((i) => i.key)
    );
    return this.steps.flatMap((step, index) => step.filter((q) => unanswered.has(q.key)).map((question) => ({ question, step: index })));
  }

  /** How many things were answered "I don't know" or "I need help" - the studio will ask about them later. */
  get skippedCount(): number {
    return Object.values(this.answers).filter((a) => isSpecial(a) && specialKind(a) !== 'not_applicable').length;
  }

  stepDone(index: number): boolean {
    const step = this.steps[index];
    return !!step && step.filter((q) => q.required).every((q) => isAnswered(this.answers[q.key]));
  }

  stepHasRequired(index: number): boolean {
    return !!this.steps[index]?.some((q) => q.required);
  }

  go(index: number): void {
    if (index < 0 || index >= this.steps.length || index === this.stepIndex) {
      return;
    }
    this.flush();
    this.stepIndex = index;
    this.scrollToTop();
  }

  next(): void {
    this.go(this.stepIndex + 1);
  }

  back(): void {
    this.go(this.stepIndex - 1);
  }

  /** Jumps to the step holding a question and brings it into view. */
  goTo(step: number, key: string): void {
    this.go(step);
    setTimeout(() => document.querySelector(`[data-question="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  onAnswers(answers: AnswerMap): void {
    this.answers = answers;
    this.dirty = true;
    this.version++;
    this.saveStatus = 'pending';
    this.rebuildSteps();
    // Once messages are showing, keep them honest as the answers change: each disappears the moment its problem is fixed.
    if (Object.keys(this.errors).length && this.state?.definition) {
      this.errors = Object.fromEntries(validateForComplete(this.state.definition, answers).map((i) => [i.key, i.message]));
    }
    this.changed$.next();
  }

  /** Saves now (the page also does this on its own a moment after each change). */
  save(silent = false): void {
    if (!this.editable || !this.dirty) {
      return;
    }
    if (this.saving) {
      this.queued = true;
      return;
    }

    const sentVersion = this.version;
    this.saving = true;
    this.saveStatus = 'saving';
    this.studio
      .saveAnswers(this.payload())
      .pipe(
        finalize(() => {
          this.saving = false;
          if (this.queued) {
            this.queued = false;
            this.save(true);
          }
        })
      )
      .subscribe({
        next: (state) => {
          this.savedAt = new Date();
          this.saveStatus = 'saved';
          if (this.version === sentVersion) {
            this.apply(state);
          } else {
            // The tenant kept typing while this was on its way: keep what is on screen, and save that next.
            this.state = state;
            this.queued = true;
          }
          if (!silent) {
            this.notify.success('Progress saved.');
          }
        },
        error: () => (this.saveStatus = 'error'),
      });
  }

  complete(): void {
    const definition = this.state?.definition;
    if (!definition || !this.editable || this.completing) {
      return;
    }

    const issues = validateForComplete(definition, this.answers);
    this.errors = Object.fromEntries(issues.map((i) => [i.key, i.message]));
    if (issues.length) {
      this.showMissing = true;
      this.notify.error('Some questions still need an answer.');
      const first = this.missing[0];
      if (first) {
        this.goTo(first.step, first.question.key);
      }
      return;
    }

    this.completing = true;
    const finish = () =>
      this.studio
        .completeQuestionnaire()
        .pipe(finalize(() => (this.completing = false)))
        .subscribe({
          next: (result) => {
            this.apply(result.state);
            this.completion = { created: result.factsCreated, updated: result.factsUpdated, retired: result.factsRetired };
            this.showMissing = false;
            this.notify.success('Questionnaire completed.');
          },
        });

    if (!this.dirty) {
      finish();
      return;
    }

    this.studio.saveAnswers(this.payload()).subscribe({
      next: (state) => {
        this.apply(state);
        finish();
      },
      error: () => (this.completing = false),
    });
  }

  restart(): void {
    if (this.restarting) {
      return;
    }

    this.restarting = true;
    this.studio
      .restartQuestionnaire()
      .pipe(finalize(() => (this.restarting = false)))
      .subscribe((state) => {
        this.completion = null;
        this.apply(state);
        this.stepIndex = 0;
      });
  }

  // ----- answer history ----------------------------------------------------------------------------------------------------------

  toggleHistory(): void {
    this.historyOpen = !this.historyOpen;
    if (this.historyOpen) {
      this.loadHistory();
    }
  }

  promptOf(key: string): string {
    return this.state?.definition?.questions.find((q) => q.key === key)?.prompt ?? key;
  }

  /** An answer as a person would read it: option labels, yes/no, fields joined, a "don't know" in words. */
  describe(key: string, value: unknown): string {
    if (value === null || value === undefined) {
      return 'nothing';
    }
    if (isSpecial(value)) {
      return SPECIAL_LABELS[specialKind(value) as SpecialKind] ?? 'skipped';
    }
    const question = this.state?.definition?.questions.find((q) => q.key === key);
    const label = (v: unknown) => question?.options?.find((o) => o.value === v)?.label ?? String(v);
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return value.map(label).join(', ');
    }
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => isAnswered(v))
        .map(([k, v]) => `${question?.fields?.find((f) => f.key === k)?.label ?? k}: ${v}`)
        .join('; ');
    }
    return label(value);
  }

  // ----- internals ---------------------------------------------------------------------------------------------------------------

  private loadHistory(): void {
    this.historyLoading = true;
    this.studio
      .getAnswerHistory(null, 50)
      .pipe(finalize(() => (this.historyLoading = false)))
      .subscribe({ next: (history) => (this.history = history) });
  }

  /** Saves any unsaved change straight away - before moving to another step, so nothing waits on the timer. */
  private flush(): void {
    if (this.dirty) {
      this.save(true);
    }
  }

  private apply(state: QuestionnaireState): void {
    this.state = state;
    this.answers = state.answers ?? {};
    this.errors = {};
    this.dirty = false;
    this.rebuildSteps();
    if (this.historyOpen) {
      this.loadHistory();
    }
  }

  private rebuildSteps(): void {
    const definition = this.state?.definition;
    this.steps = definition ? stepsOf(definition, visibleKeys(definition, this.answers)) : [];
    this.stepIndex = Math.min(this.stepIndex, Math.max(this.steps.length - 1, 0));
  }

  /** Opens at the first step that still has a mandatory question unanswered, so coming back later picks up where they stopped. */
  private resume(): void {
    if (!this.editable) {
      return;
    }
    const firstOpen = this.steps.findIndex((_, i) => !this.stepDone(i));
    this.stepIndex = firstOpen < 0 ? 0 : firstOpen;
  }

  private scrollToTop(): void {
    setTimeout(() => document.querySelector('.wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /** Everything now answered, plus an explicit null for each answer that was cleared, so the server drops it. */
  private payload(): Record<string, unknown> {
    const payload: Record<string, unknown> = { ...this.answers };
    for (const key of Object.keys(this.state?.answers ?? {})) {
      if (!(key in payload)) {
        payload[key] = null;
      }
    }
    return payload;
  }
}

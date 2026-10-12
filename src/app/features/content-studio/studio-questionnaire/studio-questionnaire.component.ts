import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { AnswerMap, QuestionnaireResponseStatus, QuestionnaireState } from '../../../core/models/content-studio.model';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';
import { isAnswered, validateForComplete, visibleKeys } from '../../../core/utils/questionnaire-engine';

/**
 * The tenant's questionnaire about its own business. The platform decides the questions (by industry); the tenant answers, the
 * screen shows and hides conditional questions as it goes, and completing it drafts the business facts the studio will later be
 * allowed to say once someone verifies them. Answers can be saved part-way and finished later. Once completed it reads as a
 * summary, and "Update my answers" starts a fresh round that keeps every answer that still fits (and moves to a newer version).
 */
@Component({
  selector: 'app-studio-questionnaire',
  templateUrl: './studio-questionnaire.component.html',
  styleUrls: ['./studio-questionnaire.component.scss'],
})
export class StudioQuestionnaireComponent implements OnInit {
  readonly status = QuestionnaireResponseStatus;

  state: QuestionnaireState | null = null;
  answers: AnswerMap = {};
  errors: Record<string, string> = {};
  /** Set for the moment after completing, to say what happened to the business facts. */
  completion: { created: number; updated: number; retired: number } | null = null;

  loading = true;
  saving = false;
  completing = false;
  restarting = false;
  dirty = false;

  constructor(
    private readonly studio: ContentStudioService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.studio
      .getQuestionnaire()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (state) => this.apply(state) });
  }

  get editable(): boolean {
    return !!this.state?.available && this.state.status === QuestionnaireResponseStatus.InProgress;
  }

  /** Required questions that are asked right now, and how many of them have an answer. */
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

  onAnswers(answers: AnswerMap): void {
    this.answers = answers;
    this.dirty = true;
    // Once messages are showing, keep them honest as the answers change: each disappears the moment its problem is fixed.
    if (Object.keys(this.errors).length && this.state?.definition) {
      this.errors = Object.fromEntries(validateForComplete(this.state.definition, answers).map((i) => [i.key, i.message]));
    }
  }

  save(): void {
    if (!this.editable || this.saving || !this.dirty) {
      return;
    }

    this.saving = true;
    this.studio
      .saveAnswers(this.payload())
      .pipe(finalize(() => (this.saving = false)))
      .subscribe((state) => {
        this.apply(state);
        this.notify.success('Progress saved.');
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
      this.notify.error('Some questions still need an answer.');
      setTimeout(() => document.querySelector('.question--error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
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
      });
  }

  private apply(state: QuestionnaireState): void {
    this.state = state;
    this.answers = state.answers ?? {};
    this.errors = {};
    this.dirty = false;
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

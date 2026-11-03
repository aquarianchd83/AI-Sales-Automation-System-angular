import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

import {
  AnswerMap,
  AnswerValue,
  QuestionDef,
  QuestionField,
  QuestionnaireDefinition,
  SPECIAL_LABELS,
  SpecialKind,
} from '../../../core/models/content-studio.model';
import { MAX_POINT_LENGTH, MAX_POINTS, isAnswered, isSpecial, special, specialKind, visibleKeys } from '../../../core/utils/questionnaire-engine';

/**
 * Renders a questionnaire definition as a form: one control per question type, conditional questions appearing and disappearing as
 * the answers change. Presentational - it holds no state of its own beyond which questions are asked; the parent owns the answers
 * and receives every change through <c>answersChange</c>. Used by the tenant's questionnaire page and by the platform editor's
 * preview, so what the operator previews is exactly what a tenant sees.
 */
@Component({
  selector: 'app-questionnaire-form',
  templateUrl: './questionnaire-form.component.html',
  styleUrls: ['./questionnaire-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionnaireFormComponent implements OnChanges {
  @Input() definition: QuestionnaireDefinition | null = null;
  @Input() answers: AnswerMap = {};
  /** Messages by question key (and "question.field" for a structured field), shown beneath the question. */
  @Input() errors: Record<string, string> = {};
  @Input() readonly = false;
  /** When set, only the asked questions with these keys are shown - one small step of the wizard. Numbering still counts every asked question. */
  @Input() stepKeys: string[] | null = null;

  @Output() answersChange = new EventEmitter<AnswerMap>();

  /** The questions shown now. */
  visible: QuestionDef[] = [];
  /** Every question that is asked, in order - what the numbers count. */
  private asked: QuestionDef[] = [];

  readonly specials: SpecialKind[] = ['unknown', 'need_help', 'not_applicable'];
  readonly maxPointLength = MAX_POINT_LENGTH;

  /**
   * The rows of each point-list question as typed, including blank ones the tenant has added but not filled yet. The answer only ever holds the
   * filled points; this keeps the empty row on screen so adding a point does not look like nothing happened.
   */
  private pointDrafts: Record<string, string[]> = {};

  ngOnChanges(): void {
    this.syncPointDrafts();
    this.refreshVisible();
  }

  trackByKey(_: number, question: QuestionDef): string {
    return question.key;
  }

  /** 1-based position among the questions that are asked, so numbering never jumps over a hidden one. */
  numberOf(question: QuestionDef): number {
    return this.asked.indexOf(question) + 1;
  }

  text(question: QuestionDef): string {
    const value = this.answers[question.key];
    return typeof value === 'string' ? value : '';
  }

  trackByIndex(index: number): number {
    return index;
  }

  /** The rows to show for a point-list question: always at least one, so there is somewhere to type. */
  pointRows(question: QuestionDef): string[] {
    return this.pointDrafts[question.key] ?? this.answerPoints(question, true);
  }

  canAddPoint(question: QuestionDef): boolean {
    return this.pointRows(question).length < MAX_POINTS;
  }

  setPoint(question: QuestionDef, index: number, value: string): void {
    const rows = [...this.pointRows(question)];
    rows[index] = value;
    this.commitPoints(question, rows);
  }

  addPoint(question: QuestionDef): void {
    if (this.canAddPoint(question)) {
      this.commitPoints(question, [...this.pointRows(question), '']);
    }
  }

  removePoint(question: QuestionDef, index: number): void {
    const rows = this.pointRows(question).filter((_, i) => i !== index);
    this.commitPoints(question, rows.length ? rows : ['']);
  }

  numberValue(question: QuestionDef): number | '' {
    const value = this.answers[question.key];
    return typeof value === 'number' ? value : '';
  }

  boolValue(question: QuestionDef): boolean | null {
    const value = this.answers[question.key];
    return typeof value === 'boolean' ? value : null;
  }

  chosen(question: QuestionDef): string | null {
    const value = this.answers[question.key];
    return typeof value === 'string' ? value : null;
  }

  isPicked(question: QuestionDef, option: string): boolean {
    const value = this.answers[question.key];
    return Array.isArray(value) && value.includes(option);
  }

  fieldText(question: QuestionDef, field: QuestionField): string {
    const value = this.object(question)[field.key];
    return typeof value === 'string' ? value : '';
  }

  fieldNumber(question: QuestionDef, field: QuestionField): number | '' {
    const value = this.object(question)[field.key];
    return typeof value === 'number' ? value : '';
  }

  fieldBool(question: QuestionDef, field: QuestionField): boolean | null {
    const value = this.object(question)[field.key];
    return typeof value === 'boolean' ? value : null;
  }

  setText(question: QuestionDef, value: string): void {
    this.commit(question.key, value.trim() === '' ? undefined : value);
  }

  setNumber(question: QuestionDef, raw: string): void {
    const parsed = raw.trim() === '' ? undefined : Number(raw);
    this.commit(question.key, parsed === undefined || Number.isNaN(parsed) ? undefined : parsed);
  }

  setBool(question: QuestionDef, value: boolean | null): void {
    this.commit(question.key, value === null ? undefined : value);
  }

  setChoice(question: QuestionDef, value: string | null): void {
    this.commit(question.key, value ?? undefined);
  }

  togglePick(question: QuestionDef, option: string, on: boolean): void {
    const current = this.answers[question.key];
    const picked = Array.isArray(current) ? [...current] : [];
    const next = on ? (picked.includes(option) ? picked : [...picked, option]) : picked.filter((p) => p !== option);
    this.commit(question.key, next.length ? next : undefined);
  }

  setFieldText(question: QuestionDef, field: QuestionField, value: string): void {
    this.commitField(question, field, value.trim() === '' ? null : value);
  }

  setFieldNumber(question: QuestionDef, field: QuestionField, raw: string): void {
    const parsed = raw.trim() === '' ? null : Number(raw);
    this.commitField(question, field, parsed === null || Number.isNaN(parsed) ? null : parsed);
  }

  setFieldBool(question: QuestionDef, field: QuestionField, value: boolean | null): void {
    this.commitField(question, field, value);
  }

  /** Whether the tenant answered this one with "I don't know" / "I need help" / "Not applicable" instead of an answer. */
  isSkipped(question: QuestionDef): boolean {
    return isSpecial(this.answers[question.key]);
  }

  skipLabel(question: QuestionDef): string {
    return SPECIAL_LABELS[specialKind(this.answers[question.key]) as SpecialKind] ?? '';
  }

  skipLabelOf(kind: SpecialKind): string {
    return SPECIAL_LABELS[kind];
  }

  /** The skip options are offered unless the question insists on a real answer. */
  canSkip(question: QuestionDef): boolean {
    return !question.requireKnown && !this.readonly;
  }

  setSpecial(question: QuestionDef, kind: SpecialKind): void {
    this.commit(question.key, special(kind));
  }

  answerInstead(question: QuestionDef): void {
    this.commit(question.key, undefined);
  }

  errorFor(key: string): string | null {
    return this.errors[key] ?? null;
  }

  /** The filled points of an answer, with one empty row when there are none. */
  private answerPoints(question: QuestionDef, padEmpty: boolean): string[] {
    const value = this.answers[question.key];
    const points = Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string') : [];
    return points.length || !padEmpty ? points : [''];
  }

  private commitPoints(question: QuestionDef, rows: string[]): void {
    this.pointDrafts = { ...this.pointDrafts, [question.key]: rows };
    const filled = rows.map((r) => r.trim()).filter((r) => r !== '');
    this.commit(question.key, filled.length ? filled : undefined);
  }

  /** When the answers change from outside (a reset, "answer it instead"), the drafts follow them; typing keeps its own blank rows. */
  private syncPointDrafts(): void {
    if (!this.definition) {
      return;
    }
    for (const q of this.definition.questions.filter((x) => x.type === 'PointList')) {
      const draft = this.pointDrafts[q.key];
      const filled = (draft ?? []).map((r) => r.trim()).filter((r) => r !== '');
      const answered = this.answerPoints(q, false);
      if (!draft || filled.length !== answered.length || filled.some((p, i) => p !== answered[i])) {
        this.pointDrafts = { ...this.pointDrafts, [q.key]: this.answerPoints(q, true) };
      }
    }
  }

  private object(question: QuestionDef): Record<string, unknown> {
    const value = this.answers[question.key];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private commitField(question: QuestionDef, field: QuestionField, value: string | number | boolean | null): void {
    const next = { ...(this.object(question) as Record<string, string | number | boolean | null>) };
    if (value === null) {
      delete next[field.key];
    } else {
      next[field.key] = value;
    }
    this.commit(question.key, Object.keys(next).length ? next : undefined);
  }

  private commit(key: string, value: AnswerValue | undefined): void {
    const next: AnswerMap = { ...this.answers };
    if (value === undefined || !isAnswered(value)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    this.answers = next;
    this.refreshVisible();
    this.answersChange.emit(next);
  }

  private refreshVisible(): void {
    if (!this.definition) {
      this.asked = [];
      this.visible = [];
      return;
    }
    const keys = visibleKeys(this.definition, this.answers);
    this.asked = this.definition.questions.filter((q) => keys.has(q.key));
    this.visible = this.stepKeys ? this.asked.filter((q) => this.stepKeys!.includes(q.key)) : this.asked;
  }
}

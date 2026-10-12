import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

import { AnswerMap, AnswerValue, QuestionDef, QuestionField, QuestionnaireDefinition } from '../../../core/models/content-studio.model';
import { isAnswered, visibleKeys } from '../../../core/utils/questionnaire-engine';

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

  @Output() answersChange = new EventEmitter<AnswerMap>();

  visible: QuestionDef[] = [];

  ngOnChanges(): void {
    this.refreshVisible();
  }

  trackByKey(_: number, question: QuestionDef): string {
    return question.key;
  }

  /** 1-based position among the questions that are asked, so numbering never jumps over a hidden one. */
  numberOf(question: QuestionDef): number {
    return this.visible.indexOf(question) + 1;
  }

  text(question: QuestionDef): string {
    const value = this.answers[question.key];
    return typeof value === 'string' ? value : '';
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

  errorFor(key: string): string | null {
    return this.errors[key] ?? null;
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
      this.visible = [];
      return;
    }
    const keys = visibleKeys(this.definition, this.answers);
    this.visible = this.definition.questions.filter((q) => keys.has(q.key));
  }
}

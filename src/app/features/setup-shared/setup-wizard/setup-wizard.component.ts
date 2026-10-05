import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import {
  SetupAnswer,
  SetupAnswers,
  SetupDefinition,
  SetupEvaluation,
  SetupField,
  SetupSection,
} from '../../../core/models/application-setup.model';
import { checkAnswers, displayAnswer, isBlankAnswer } from '../../../core/utils/setup-rules';

/** What the wizard asks its host to do. The host calls `done` when the save has finished, so the wizard knows whether to move on. */
export interface SetupSaveEvent {
  /** Only the answers that changed since the last save. */
  values: SetupAnswers;
  /** True from the review step: confirm the setup. */
  complete: boolean;
  /** True for Save & Exit: the host leaves the wizard once it has saved. */
  exit: boolean;
  done: (outcome: { ok: boolean; completed?: boolean; evaluation?: SetupEvaluation }) => void;
}

interface Step {
  kind: 'section' | 'review';
  key: string;
  title: string;
  description: string;
  fields: SetupField[];
}

type StepState = 'current' | 'done' | 'error' | 'todo';

/**
 * The guided setup. Given a plan version's definition it builds the steps itself - one per section that has at
 * least one applicable question, then a review - shows conditional questions only while their condition holds,
 * validates inline, and asks the host to persist. It knows nothing about any particular plan: a new plan or a
 * new question is just a different definition.
 *
 * `mode="preview"` is the admin's view of the same wizard: identical behaviour, nothing is saved.
 */
@Component({
  selector: 'app-setup-wizard',
  templateUrl: './setup-wizard.component.html',
  styleUrls: ['./setup-wizard.component.scss'],
})
export class SetupWizardComponent implements OnChanges {
  @Input() definition!: SetupDefinition;
  /** The answers to start from (already typed). */
  @Input() values: SetupAnswers = {};
  @Input() mode: 'edit' | 'preview' = 'edit';
  @Input() currencySymbol = '';
  @Input() saving = false;
  /** Set when the setup was complete before - the last step then offers "Save changes" rather than "Complete setup". */
  @Input() alreadyCompleted = false;
  @Input() startAtReview = false;

  @Output() save = new EventEmitter<SetupSaveEvent>();
  @Output() cancelled = new EventEmitter<void>();

  answers: SetupAnswers = {};
  steps: Step[] = [];
  current = 0;
  percent = 0;
  answeredRequired = 0;
  totalRequired = 0;

  private baseline: SetupAnswers = {};
  private visible = new Set<string>();
  private readonly touched = new Set<string>();
  private readonly visited = new Set<number>();
  private serverErrors = new Map<string, string>();
  private issues = new Map<string, string>();
  private initialised = false;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['definition'] || changes['values']) {
      this.answers = { ...this.values };
      this.baseline = { ...this.values };
      this.touched.clear();
      this.serverErrors.clear();
      this.recompute();
      if (!this.initialised || changes['definition']) {
        this.current = this.startAtReview ? this.steps.length - 1 : this.firstUnfinishedStep();
        this.visited.clear();
        this.visited.add(this.current);
      }
      this.initialised = true;
    }
  }

  // ---- derived view state ------------------------------------------------------------------------------------------

  get step(): Step | undefined {
    return this.steps[this.current];
  }

  get isReview(): boolean {
    return this.step?.kind === 'review';
  }

  get isLast(): boolean {
    return this.current === this.steps.length - 1;
  }

  get reviewSections(): { section: Step; index: number; rows: { label: string; value: string; key: string }[] }[] {
    return this.steps
      .map((section, index) => ({ section, index }))
      .filter((s) => s.section.kind === 'section')
      .map((s) => ({
        ...s,
        rows: s.section.fields.map((f) => ({
          key: f.fieldKey,
          label: f.label,
          value: displayAnswer(f, this.answers[f.fieldKey], this.currencySymbol),
        })),
      }));
  }

  hasIssue(key: string): boolean {
    return this.issues.has(key);
  }

  get issueCount(): number {
    return this.issues.size;
  }

  /** The error to show under a field: the server's if it disagreed, else ours once the field was touched / attempted. */
  errorFor(field: SetupField): string | null {
    const server = this.serverErrors.get(field.fieldKey);
    if (server) {
      return server;
    }
    return this.touched.has(field.fieldKey) ? this.issues.get(field.fieldKey) ?? null : null;
  }

  stepState(index: number): StepState {
    if (index === this.current) {
      return 'current';
    }
    const step = this.steps[index];
    if (step.kind === 'review') {
      return 'todo';
    }
    if (step.fields.some((f) => this.touched.has(f.fieldKey) && this.issues.has(f.fieldKey))) {
      return 'error';
    }
    const complete = step.fields.every((f) => !this.issues.has(f.fieldKey));
    // Done once it has been looked at, or already holds answers (a setup that is being re-opened).
    const seen = this.visited.has(index) || step.fields.some((f) => !isBlankAnswer(f, this.answers[f.fieldKey]));
    return complete && seen ? 'done' : 'todo';
  }

  stepIcon(index: number): string {
    switch (this.stepState(index)) {
      case 'done':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'current':
        return this.steps[index].kind === 'review' ? 'fact_check' : 'arrow_circle_right';
      default:
        return this.steps[index].kind === 'review' ? 'fact_check' : 'radio_button_unchecked';
    }
  }

  trackStep(_: number, step: Step): string {
    return step.key;
  }

  trackField(_: number, field: SetupField): string {
    return field.fieldKey;
  }

  /** Wide inputs span the whole row; short ones sit two to a row. */
  isWide(field: SetupField): boolean {
    return ['MultilineText', 'MultiSelect', 'Radio', 'Checkbox', 'FileUpload'].includes(field.fieldType);
  }

  // ---- editing -----------------------------------------------------------------------------------------------------

  onValue(field: SetupField, value: SetupAnswer): void {
    this.answers = { ...this.answers, [field.fieldKey]: value };
    this.serverErrors.delete(field.fieldKey);
    this.recompute();
  }

  touch(field: SetupField): void {
    this.touched.add(field.fieldKey);
  }

  // ---- navigation --------------------------------------------------------------------------------------------------

  goTo(index: number): void {
    if (index < 0 || index >= this.steps.length || index === this.current) {
      return;
    }
    this.current = index;
    this.visited.add(index);
    this.scrollToTop();
  }

  back(): void {
    this.goTo(this.current - 1);
  }

  /** Save & Continue: validate this step, save, then move on. */
  next(): void {
    const step = this.step;
    if (!step || step.kind === 'review') {
      return;
    }
    if (!this.validateStep(step)) {
      return;
    }
    this.persist({ complete: false, exit: false }, () => this.goTo(this.current + 1));
  }

  /** Save & Exit: whatever is filled in is kept; nothing has to be valid yet. */
  saveAndExit(): void {
    if (this.mode === 'preview') {
      this.cancelled.emit();
      return;
    }
    this.persist({ complete: false, exit: true }, () => undefined);
  }

  /** Review step: confirm the setup. Anything still wrong sends the Talent back to the right step. */
  complete(): void {
    const problem = this.firstProblemStep();
    if (problem >= 0) {
      this.steps[problem].fields.forEach((f) => this.touched.add(f.fieldKey));
      this.steps.forEach((s) => s.fields.forEach((f) => this.issues.has(f.fieldKey) && this.touched.add(f.fieldKey)));
      this.goTo(problem);
      this.focusFirstError();
      return;
    }
    this.persist({ complete: true, exit: false }, () => undefined);
  }

  // ---- internals ---------------------------------------------------------------------------------------------------

  private persist(flags: { complete: boolean; exit: boolean }, onOk: () => void): void {
    if (this.mode === 'preview') {
      onOk();
      return;
    }

    const changed: SetupAnswers = {};
    for (const key of Object.keys(this.answers)) {
      if (JSON.stringify(this.normalise(this.answers[key])) !== JSON.stringify(this.normalise(this.baseline[key]))) {
        changed[key] = this.normalise(this.answers[key]);
      }
    }

    this.save.emit({
      values: changed,
      ...flags,
      done: (outcome) => {
        if (!outcome.ok) {
          return;
        }
        this.baseline = { ...this.answers };
        this.serverErrors.clear();
        for (const issue of outcome.evaluation?.invalid ?? []) {
          // Only what the client rules did not already catch - the two sets normally agree.
          if (!this.issues.has(issue.fieldKey)) {
            this.serverErrors.set(issue.fieldKey, issue.message);
          }
        }
        onOk();
      },
    });
  }

  private normalise(value: SetupAnswer | undefined): SetupAnswer {
    if (value === undefined || value === '') {
      return null;
    }
    return Array.isArray(value) && value.length === 0 ? null : value;
  }

  private validateStep(step: Step): boolean {
    let ok = true;
    for (const field of step.fields) {
      this.touched.add(field.fieldKey);
      if (this.issues.has(field.fieldKey)) {
        ok = false;
      }
    }
    if (!ok) {
      this.focusFirstError();
    }
    return ok;
  }

  private firstProblemStep(): number {
    return this.steps.findIndex((s) => s.kind === 'section' && s.fields.some((f) => this.issues.has(f.fieldKey)));
  }

  private firstUnfinishedStep(): number {
    const index = this.firstProblemStep();
    // A setup with nothing outstanding opens on its review; otherwise on the first step that still needs something.
    return index >= 0 ? index : Math.max(0, this.steps.length - 1);
  }

  private recompute(): void {
    const all = this.definition?.sections.flatMap((s) => s.fields) ?? [];
    const result = checkAnswers(all, this.answers);
    this.visible = result.visible;
    this.issues = new Map([...result.missing, ...result.invalid].map((i) => [i.fieldKey, i.message]));

    const required = all.filter((f) => f.isRequired && this.visible.has(f.fieldKey));
    this.totalRequired = required.length;
    this.answeredRequired = required.filter((f) => !this.issues.has(f.fieldKey)).length;
    this.percent = this.totalRequired === 0 ? 100 : Math.floor((100 * this.answeredRequired) / this.totalRequired);

    const sections: Step[] = (this.definition?.sections ?? [])
      .map((s: SetupSection) => ({
        kind: 'section' as const,
        key: s.key,
        title: s.title,
        description: s.description,
        fields: s.fields.filter((f) => this.visible.has(f.fieldKey)),
      }))
      .filter((s) => s.fields.length > 0);

    this.steps = [
      ...sections,
      { kind: 'review', key: '__review', title: 'Review & Confirm', description: 'Check your answers before you finish.', fields: [] },
    ];
    this.current = Math.min(this.current, this.steps.length - 1);
  }

  private focusFirstError(): void {
    setTimeout(() => {
      const invalid = this.host.nativeElement.querySelector<HTMLElement>('.has-error input, .has-error textarea, .mat-form-field-invalid input, .mat-form-field-invalid textarea, .mat-mdc-form-field-error');
      invalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (invalid as HTMLInputElement | null)?.focus?.();
    });
  }

  private scrollToTop(): void {
    this.host.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
}

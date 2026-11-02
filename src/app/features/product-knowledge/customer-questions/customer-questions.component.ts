import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { NEXT_STEP_DETAIL_MAX, NEXT_STEP_OPTIONS, QUALIFICATION_LIMITS, QualificationField, dataTypeLabel } from '../../../core/models/qualification.model';
import { NotificationService } from '../../../core/services/notification.service';
import { QualificationService } from '../../../core/services/qualification.service';
import { CustomerQuestionDialogComponent, CustomerQuestionDialogData } from './customer-question-dialog.component';

/**
 * The questions this business wants its AI to find out from customers while it chats - "are you using any other software?", "how many
 * people on your team?" - which differ by product. The AI asks at most one at a time, only when it fits, and never asks what the customer
 * already said. The list is in the order the AI works through it.
 */
@Component({
  selector: 'app-customer-questions',
  templateUrl: './customer-questions.component.html',
  styleUrls: ['./customer-questions.component.scss'],
})
export class CustomerQuestionsComponent implements OnInit {
  readonly displayedColumns = ['question', 'type', 'answered', 'active', 'actions'];
  readonly maxFields = QUALIFICATION_LIMITS.maxFields;
  readonly dataTypeLabel = dataTypeLabel;

  fields: QualificationField[] = [];
  loading = true;
  loadFailed = false;
  busy = false;

  readonly nextStepOptions = NEXT_STEP_OPTIONS;
  readonly nextStepDetailMax = NEXT_STEP_DETAIL_MAX;
  readonly nextStepForm = this.fb.nonNullable.group({
    goal: ['Enquiry'],
    detail: ['', [Validators.maxLength(NEXT_STEP_DETAIL_MAX)]],
  });
  nextStepSaving = false;
  nextStepLoaded = false;

  constructor(
    private readonly questions: QualificationService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.load();
    this.questions.getNextStep().subscribe({
      next: (step) => {
        this.nextStepForm.reset({ goal: step.goal, detail: step.detail ?? '' });
        this.nextStepLoaded = true;
      },
      error: () => (this.nextStepLoaded = true),
    });
  }

  get offersNextStep(): boolean {
    return this.nextStepForm.controls.goal.value !== 'Enquiry';
  }

  saveNextStep(): void {
    if (this.nextStepForm.invalid || this.nextStepSaving) {
      this.nextStepForm.markAllAsTouched();
      return;
    }
    const { goal, detail } = this.nextStepForm.getRawValue();
    this.nextStepSaving = true;
    this.questions
      .setNextStep(goal, goal === 'Enquiry' ? null : detail.trim() || null)
      .pipe(finalize(() => (this.nextStepSaving = false)))
      .subscribe((saved) => {
        this.nextStepForm.reset({ goal: saved.goal, detail: saved.detail ?? '' });
        this.notify.success(saved.goal === 'Enquiry' ? 'The AI will not offer a next step.' : 'Saved. The AI will mention it once, mid-conversation.');
      });
  }

  get atLimit(): boolean {
    return this.fields.length >= this.maxFields;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.questions
      .list()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (fields) => (this.fields = this.inAskOrder(fields)),
        error: () => (this.loadFailed = true),
      });
  }

  add(): void {
    this.openForm({ mode: 'create', nextSortOrder: this.fields.length });
  }

  edit(field: QualificationField): void {
    this.openForm({ mode: 'edit', field, nextSortOrder: this.fields.length });
  }

  addStarterQuestions(): void {
    this.busy = true;
    this.questions
      .seedDefaults()
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((fields) => {
        this.fields = this.inAskOrder(fields);
        this.notify.success('Starter questions added.');
      });
  }

  toggle(field: QualificationField, isActive: boolean): void {
    this.busy = true;
    this.questions
      .setActive(field.id, isActive)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: (saved) => {
          this.fields = this.inAskOrder(this.fields.map((f) => (f.id === saved.id ? saved : f)));
          this.notify.success(isActive ? 'The AI will ask this again.' : 'The AI will stop asking this. Answers already collected are kept.');
        },
        // Put the switch back to what the server still has.
        error: () => (this.fields = [...this.fields]),
      });
  }

  delete(field: QualificationField): void {
    const data: ConfirmDialogData =
      field.capturedLeadCount > 0
        ? {
            title: `Can't delete "${field.displayName}"`,
            message: `${field.capturedLeadCount} lead${field.capturedLeadCount === 1 ? ' has' : 's have'} already answered it. Turn it off instead — the answers are kept and the AI stops asking.`,
            confirmLabel: 'OK',
            cancelLabel: 'Close',
          }
        : {
            title: `Delete "${field.displayName}"?`,
            message: 'No lead has answered it yet. The AI will no longer ask it.',
            confirmLabel: 'Delete',
            destructive: true,
          };

    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed || field.capturedLeadCount > 0) {
          return;
        }
        this.questions.delete(field.id).subscribe(() => {
          this.notify.success('Question deleted.');
          this.load();
        });
      });
  }

  private openForm(data: CustomerQuestionDialogData): void {
    this.dialog
      .open(CustomerQuestionDialogComponent, { data, width: '560px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  /** The order the AI uses: required first, then by importance, then by position. */
  private inAskOrder(fields: QualificationField[]): QualificationField[] {
    return [...fields].sort(
      (a, b) =>
        Number(b.isRequired) - Number(a.isRequired) ||
        b.priority - a.priority ||
        a.sortOrder - b.sortOrder ||
        a.fieldKey.localeCompare(b.fieldKey)
    );
  }
}

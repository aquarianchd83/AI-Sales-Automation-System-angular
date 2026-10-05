import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  FOLLOW_UP_MAX_MONTHS,
  FOLLOW_UP_MAX_SENT_PER_LEAD,
  FOLLOW_UP_MIN_DAYS_AHEAD,
  FOLLOW_UP_MONTH_CHOICES,
  LeadFollowUp,
  LeadFollowUpStatus,
  followUpStatusChipClass,
  followUpWaitLabel,
  isFollowUpActionable,
  isFollowUpOverdue,
} from '../../../core/models/lead-follow-up.model';
import { MessageTemplate, WhatsAppTemplateStatus } from '../../../core/models/message-template.model';
import { LeadFollowUpService } from '../../../core/services/lead-follow-up.service';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** The choice in the "wait" toggle: a number of months, or an exact date. */
export type FollowUpWaitChoice = number | 'custom';

/**
 * "Follow up later" on a lead: for a customer who was interested but could not go ahead (budget, timing, a
 * pending decision), pick how long to wait - 1, 2 or 3 months, or a date - and which approved template to send
 * then. The reminder goes out once, in daytime hours, and never to someone who has since written in or opted
 * out; the API enforces that, this panel only says so.
 */
@Component({
  selector: 'app-lead-follow-up-panel',
  templateUrl: './lead-follow-up-panel.component.html',
  styleUrls: ['./lead-follow-up-panel.component.scss'],
})
export class LeadFollowUpPanelComponent implements OnChanges {
  @Input() leadId = '';
  /** False for a Won/Lost lead: the history stays visible, scheduling and cancelling do not. */
  @Input() canEdit = true;
  /** Fires after anything that adds a row to the lead's activity timeline. */
  @Output() readonly changed = new EventEmitter<void>();

  readonly monthChoices = FOLLOW_UP_MONTH_CHOICES;
  readonly minDaysAhead = FOLLOW_UP_MIN_DAYS_AHEAD;
  readonly maxSent = FOLLOW_UP_MAX_SENT_PER_LEAD;
  readonly statusClass = followUpStatusChipClass;
  readonly waitLabel = followUpWaitLabel;
  readonly actionable = isFollowUpActionable;
  readonly overdue = isFollowUpOverdue;

  readonly form = this.fb.nonNullable.group({
    choice: [1 as FollowUpWaitChoice],
    date: [null as Date | null],
    templateId: ['', [Validators.required]],
    reason: ['', [Validators.maxLength(500)]],
  });

  followUps: LeadFollowUp[] = [];
  templates: MessageTemplate[] = [];
  loading = false;
  saving = false;
  busyId: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly followUpService: LeadFollowUpService,
    private readonly templateService: MessageTemplateService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['leadId'] && this.leadId) {
      this.reload();
      this.loadTemplates();
    }
  }

  /** The one waiting follow-up, if any - scheduling again replaces it. */
  get pending(): LeadFollowUp | undefined {
    return this.followUps.find((f) => f.status === LeadFollowUpStatus.Scheduled);
  }

  /** What the AI proposed after the customer said they cannot go ahead. Nothing happens until a person confirms. */
  get suggestion(): LeadFollowUp | undefined {
    return this.followUps.find((f) => f.status === LeadFollowUpStatus.Suggested);
  }

  /** Failed ones stay actionable on their own, so they are shown with the pending one rather than buried. */
  get needsAttention(): LeadFollowUp[] {
    return this.followUps.filter((f) => f.status === LeadFollowUpStatus.Failed);
  }

  get history(): LeadFollowUp[] {
    return this.followUps.filter((f) => f.status !== LeadFollowUpStatus.Scheduled && f.status !== LeadFollowUpStatus.Suggested);
  }

  get sentCount(): number {
    return this.followUps.filter((f) => f.status === LeadFollowUpStatus.Sent).length;
  }

  get limitReached(): boolean {
    return this.sentCount >= this.maxSent;
  }

  get customChosen(): boolean {
    return this.form.controls.choice.value === 'custom';
  }

  /** The earliest date the picker offers: a week from now is the API's floor, and the date is read as midnight. */
  get minDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + FOLLOW_UP_MIN_DAYS_AHEAD + 1);
    return date;
  }

  get maxDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + FOLLOW_UP_MAX_MONTHS);
    return date;
  }

  /** When the chosen wait lands, so "2 months" is never an abstraction. */
  get dueDatePreview(): Date | null {
    const { choice, date } = this.form.getRawValue();
    if (choice === 'custom') {
      return date;
    }
    const due = new Date();
    due.setMonth(due.getMonth() + choice);
    return due;
  }

  /** The label over the wait toggle: what pressing Schedule will do. */
  get formLabel(): string {
    if (this.suggestion) {
      return 'Confirm the follow-up';
    }
    return this.pending ? 'Reschedule (replaces the one above)' : 'Remind me in';
  }

  get canSubmit(): boolean {
    const { choice, date } = this.form.getRawValue();
    return this.form.valid && !this.saving && (choice !== 'custom' || !!date);
  }

  reload(): void {
    this.loading = true;
    this.followUpService
      .getForLead(this.leadId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (followUps) => (this.followUps = followUps),
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  schedule(): void {
    if (!this.canSubmit) {
      this.form.markAllAsTouched();
      return;
    }
    const { choice, date, templateId, reason } = this.form.getRawValue();
    this.saving = true;
    this.followUpService
      .schedule(this.leadId, {
        months: choice === 'custom' ? null : choice,
        dueAt: choice === 'custom' && date ? date.toISOString() : null,
        messageTemplateId: templateId,
        reason: reason.trim() || null,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.notify.success('Follow-up scheduled.');
          this.form.patchValue({ reason: '', date: null });
          this.reload();
          this.changed.emit();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Fills the form from the AI suggestion - its wait and reason - so confirming is choosing a message and pressing
   * Schedule. A wait that is not 1, 2 or 3 months becomes the exact date. */
  useSuggestion(suggestion: LeadFollowUp): void {
    const months = suggestion.intervalMonths;
    const quick = months != null && this.monthChoices.includes(months);
    this.form.patchValue({
      choice: quick ? months : 'custom',
      date: quick ? null : new Date(suggestion.dueAt),
      reason: suggestion.reason ?? '',
    });
    this.form.controls.reason.markAsDirty();
  }

  dismissSuggestion(suggestion: LeadFollowUp): void {
    this.confirm(
      {
        title: 'Dismiss this suggestion?',
        message: 'No follow-up will be scheduled. The AI will not suggest another for this customer for a month.',
        confirmLabel: 'Dismiss',
        destructive: true,
      },
      () => this.run(suggestion, this.followUpService.cancel(suggestion.id), 'Suggestion dismissed.')
    );
  }

  cancel(followUp: LeadFollowUp): void {
    this.confirm(
      {
        title: 'Cancel this follow-up?',
        message: 'The reminder will not be sent. You can schedule a new one at any time.',
        confirmLabel: 'Cancel follow-up',
        cancelLabel: 'Keep it',
        destructive: true,
      },
      () => this.run(followUp, this.followUpService.cancel(followUp.id), 'Follow-up cancelled.')
    );
  }

  sendNow(followUp: LeadFollowUp): void {
    this.confirm(
      {
        title: 'Send the follow-up now?',
        message: `${followUp.customerName || followUp.customerPhoneNumberE164} will get the "${
          followUp.messageTemplateName ?? 'follow-up'
        }" message straight away instead of waiting for ${new Date(followUp.dueAt).toLocaleDateString()}.`,
        confirmLabel: 'Send now',
      },
      () => this.run(followUp, this.followUpService.sendNow(followUp.id), 'Follow-up sent.')
    );
  }

  private run(followUp: LeadFollowUp, call: ReturnType<LeadFollowUpService['cancel']>, success: string): void {
    this.busyId = followUp.id;
    call.pipe(finalize(() => (this.busyId = null))).subscribe({
      next: () => {
        this.notify.success(success);
        this.reload();
        this.changed.emit();
      },
      error: () => {
        // ErrorInterceptor toasts it; reload anyway - a refused send may still have ended the follow-up.
        this.reload();
        this.changed.emit();
      },
    });
  }

  private confirm(data: ConfirmDialogData, onConfirmed: () => void): void {
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          onConfirmed();
        }
      });
  }

  /** Only templates WhatsApp will accept for a message the business starts: approved and active. */
  private loadTemplates(): void {
    this.templateService.getPaged({ page: 1, pageSize: 100 }).subscribe({
      next: (page) => {
        this.templates = page.items.filter((t) => t.isActive && t.whatsAppTemplateStatus === WhatsAppTemplateStatus.Approved);
        if (!this.form.controls.templateId.value && this.templates.length) {
          this.form.controls.templateId.setValue(this.templates[0].id);
        }
      },
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }
}

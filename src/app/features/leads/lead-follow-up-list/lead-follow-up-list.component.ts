import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import {
  FOLLOW_UP_HISTORY_STATUSES,
  FOLLOW_UP_MAX_MONTHS,
  LeadFollowUp,
  LeadFollowUpSetting,
  LeadFollowUpSummary,
  followUpStatusChipClass,
  followUpWaitLabel,
  isFollowUpActionable,
  isFollowUpOverdue,
  isFollowUpSuggestion,
} from '../../../core/models/lead-follow-up.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { AppRole } from '../../../core/models/user.model';
import { TenantJob } from '../../../core/models/tenant-job.model';
import { AuthService } from '../../../core/services/auth.service';
import { TenantJobService } from '../../../core/services/tenant-job.service';
import { LeadFollowUpService } from '../../../core/services/lead-follow-up.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** What the view filter can show: the waiting follow-ups (all, or just those due within 30 days) or one of the
 * history outcomes. */
export type FollowUpView = 'scheduled' | 'due30' | string;

/** Every lead parked with a "follow up later" date - who is waiting, until when, and what happened to the rest. */
@Component({
  selector: 'app-lead-follow-up-list',
  templateUrl: './lead-follow-up-list.component.html',
  styleUrls: ['./lead-follow-up-list.component.scss'],
})
export class LeadFollowUpListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['customer', 'followUpOn', 'dueAt', 'status', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly historyStatuses = FOLLOW_UP_HISTORY_STATUSES;
  readonly statusClass = followUpStatusChipClass;
  readonly waitLabel = followUpWaitLabel;
  readonly actionable = isFollowUpActionable;
  readonly overdue = isFollowUpOverdue;
  readonly suggestion = isFollowUpSuggestion;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly viewControl = new FormControl<FollowUpView>('scheduled', { nonNullable: true });

  readonly monthChoices = Array.from({ length: FOLLOW_UP_MAX_MONTHS }, (_, i) => i + 1);
  readonly monthsControl = new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(FOLLOW_UP_MAX_MONTHS)] });
  /** The sender job's controls and the setting are for the tenant Admin; everyone else just sees the list. */
  readonly isAdmin = this.auth.hasAnyRole([AppRole.Admin]);

  setting: LeadFollowUpSetting | null = null;
  savingSetting = false;
  /** The hourly sender job - null until loaded, or for a user who may not see it. */
  job: TenantJob | null = null;
  jobBusy = false;

  page: PagedResult<LeadFollowUp> = emptyPage<LeadFollowUp>();
  summary: LeadFollowUpSummary | null = null;
  loading = true;
  busyId: string | null = null;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly followUps: LeadFollowUpService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly auth: AuthService,
    private readonly tenantJobs: TenantJobService
  ) {}

  ngOnInit(): void {
    this.loadSetting();
    this.loadJob();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.viewControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          this.loadSummary();
          const view = this.viewControl.value;
          const status = view === 'scheduled' || view === 'due30' ? undefined : view;
          const dueWithinDays = view === 'due30' ? 30 : undefined;
          return this.followUps.getPaged(this.query, status, dueWithinDays).pipe(
            catchError(() => of(emptyPage<LeadFollowUp>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  viewLead(followUp: LeadFollowUp): void {
    void this.router.navigate(['/leads', followUp.leadId]);
  }

  sendNow(followUp: LeadFollowUp, event: Event): void {
    event.stopPropagation();
    this.confirm(
      {
        title: 'Send the follow-up now?',
        message: `${followUp.customerName || followUp.customerPhoneNumberE164} will get the "${
          followUp.messageTemplateName ?? 'follow-up'
        }" message straight away instead of waiting.`,
        confirmLabel: 'Send now',
      },
      () => this.run(followUp, this.followUps.sendNow(followUp.id), 'Follow-up sent.')
    );
  }

  /** Cancels a Scheduled or Failed follow-up, or dismisses the AI suggestion. */
  cancel(followUp: LeadFollowUp, event: Event): void {
    event.stopPropagation();
    const suggestion = isFollowUpSuggestion(followUp.status);
    this.confirm(
      suggestion
        ? {
            title: 'Dismiss this suggestion?',
            message: 'No follow-up will be scheduled. The AI will not suggest another for this customer for a month.',
            confirmLabel: 'Dismiss',
            destructive: true,
          }
        : {
            title: 'Cancel this follow-up?',
            message: 'The reminder will not be sent. You can schedule a new one from the lead at any time.',
            confirmLabel: 'Cancel follow-up',
            cancelLabel: 'Keep it',
            destructive: true,
          },
      () => this.run(followUp, this.followUps.cancel(followUp.id), suggestion ? 'Suggestion dismissed.' : 'Follow-up cancelled.')
    );
  }

  /** A suggestion is confirmed on the lead, where the message is chosen. */
  review(followUp: LeadFollowUp, event: Event): void {
    event.stopPropagation();
    this.viewLead(followUp);
  }

  /** True while the job is paused and something is already due - the warning that a paused job is holding follow-ups back. */
  get pausedWithDue(): boolean {
    return !!this.job && !this.job.isEnabled && (this.summary?.dueNow ?? 0) > 0;
  }

  saveSetting(): void {
    if (this.monthsControl.invalid || this.savingSetting) {
      return;
    }
    this.savingSetting = true;
    this.followUps
      .saveSetting(this.monthsControl.value)
      .pipe(finalize(() => (this.savingSetting = false)))
      .subscribe({
        next: (setting) => {
          this.setting = setting;
          this.monthsControl.markAsPristine();
          this.notify.success('Saved. New follow-ups will be scheduled this many months ahead.');
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Pauses or resumes the hourly sender. The schedule itself stays as it is. */
  toggleSending(): void {
    const job = this.job;
    if (!job || this.jobBusy) {
      return;
    }
    this.jobBusy = true;
    this.tenantJobs
      .updateSchedule(job.jobType, { cronExpression: job.cronExpression, isEnabled: !job.isEnabled })
      .pipe(finalize(() => (this.jobBusy = false)))
      .subscribe({
        next: (updated) => {
          this.job = updated;
          this.notify.success(updated.isEnabled ? 'Follow-up sending resumed.' : 'Follow-up sending paused.');
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Runs one check right now, without waiting for the next hour. */
  checkNow(): void {
    if (!this.job || this.jobBusy) {
      return;
    }
    this.jobBusy = true;
    this.tenantJobs
      .trigger(this.job.jobType)
      .pipe(finalize(() => (this.jobBusy = false)))
      .subscribe({
        next: () => {
          this.notify.success('Checking now. The list updates in a moment.');
          setTimeout(() => this.reload$.next(), 4000);
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  private loadSetting(): void {
    this.followUps.getSetting().subscribe({
      next: (setting) => {
        this.setting = setting;
        this.monthsControl.setValue(setting.months);
        this.monthsControl.markAsPristine();
      },
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  private loadJob(): void {
    if (!this.isAdmin) {
      return;
    }
    this.tenantJobs.getJobs().subscribe({
      next: (result) => (this.job = result.jobs.find((j) => j.jobType === 'lead-follow-ups') ?? null),
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  private run(followUp: LeadFollowUp, call: ReturnType<LeadFollowUpService['cancel']>, success: string): void {
    this.busyId = followUp.id;
    call.pipe(finalize(() => (this.busyId = null))).subscribe({
      next: () => {
        this.notify.success(success);
        this.reload$.next();
      },
      error: () => {
        // ErrorInterceptor toasts it; reload anyway - a refused send may still have ended the follow-up.
        this.reload$.next();
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

  private loadSummary(): void {
    this.followUps.getSummary().subscribe({
      next: (summary) => (this.summary = summary),
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }
}

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import {
  FOLLOW_UP_HISTORY_STATUSES,
  FOLLOW_UP_MAX_MONTHS,
  LeadFollowUp,
  LeadFollowUpStatus,
  LeadFollowUpSummary,
  followUpWaitLabel,
  isFollowUpActionable,
  isFollowUpOverdue,
  isFollowUpSuggestion,
} from '../../core/models/lead-follow-up.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../core/models/paged-result.model';
import { TenantJob } from '../../core/models/tenant-job.model';
import { AppRole } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { LeadFollowUpService } from '../../core/services/lead-follow-up.service';
import { NotificationService } from '../../core/services/notification.service';
import { TenantJobService } from '../../core/services/tenant-job.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

/** What the "Show" filter can pick: the waiting follow-ups (all, or just those due within 30 days) or one history outcome. */
export type FollowUpView = 'scheduled' | 'due30' | string;

/** The months a person can pick with one click; anything else is "Custom". */
const QUICK_MONTHS = [1, 2, 3];

/**
 * Follow-ups: interested customers who could not go ahead yet, reminded on WhatsApp when the wait is over. Its own page
 * (not part of Leads or Lead discovery) - the wait setting, the hourly sender, and the list of who is waiting.
 */
@Component({
  selector: 'app-follow-ups',
  templateUrl: './follow-ups.component.html',
  styleUrls: ['./follow-ups.component.scss'],
})
export class FollowUpsComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['lead', 'followUpOn', 'scheduledDate', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly historyStatuses = FOLLOW_UP_HISTORY_STATUSES;
  readonly quickMonths = QUICK_MONTHS;
  readonly customMonths = Array.from({ length: FOLLOW_UP_MAX_MONTHS }, (_, i) => i + 1).filter((m) => !QUICK_MONTHS.includes(m));
  readonly waitLabel = followUpWaitLabel;
  readonly actionable = isFollowUpActionable;
  readonly suggestion = isFollowUpSuggestion;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly viewControl = new FormControl<FollowUpView>('scheduled', { nonNullable: true });
  readonly monthsControl = new FormControl<number>(1, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1), Validators.max(FOLLOW_UP_MAX_MONTHS)],
  });

  /** The setting and the sender job belong to the tenant Admin; everyone else just sees the list. */
  readonly isAdmin = this.auth.hasAnyRole([AppRole.Admin]);

  /** The months saved on the server. */
  savedMonths = 1;
  /** True while "Custom…" is the chosen option, so the 4-12 picker shows. */
  customChosen = false;
  savingSetting = false;
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
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly auth: AuthService,
    private readonly tenantJobs: TenantJobService
  ) {}

  ngOnInit(): void {
    this.loadSetting();
    this.loadJob();

    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe((search) => {
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

  // ---- the "send after" setting ----

  /** Which of 1 / 2 / 3 / Custom is lit. */
  get monthsChoice(): number | 'custom' {
    return this.customChosen || !QUICK_MONTHS.includes(this.monthsControl.value) ? 'custom' : this.monthsControl.value;
  }

  chooseMonths(value: number | 'custom'): void {
    if (value === 'custom') {
      this.customChosen = true;
      if (QUICK_MONTHS.includes(this.monthsControl.value)) {
        this.monthsControl.setValue(this.customMonths[0]);
      }
    } else {
      this.customChosen = false;
      this.monthsControl.setValue(value);
    }
    this.monthsControl.markAsDirty();
  }

  get settingChanged(): boolean {
    return this.monthsControl.value !== this.savedMonths;
  }

  saveSetting(): void {
    if (this.monthsControl.invalid || this.savingSetting || !this.settingChanged) {
      return;
    }
    this.savingSetting = true;
    this.followUps
      .saveSetting(this.monthsControl.value)
      .pipe(finalize(() => (this.savingSetting = false)))
      .subscribe({
        next: (setting) => {
          this.savedMonths = setting.months;
          this.notify.success('Saved. New follow-ups will be scheduled this many months ahead.');
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  // ---- the hourly sender ----

  /** Paused while something is already due: the sender is holding follow-ups back. */
  get pausedWithDue(): boolean {
    return !!this.job && !this.job.isEnabled && (this.summary?.dueNow ?? 0) > 0;
  }

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

  // ---- the list ----

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  /** The label on the status chip next to the lead's name. */
  statusLabel(f: LeadFollowUp): string {
    if (f.status === LeadFollowUpStatus.Suggested) {
      return 'Suggested by AI';
    }
    return isFollowUpOverdue(f) ? 'Due - waiting' : f.status;
  }

  statusClass(f: LeadFollowUp): string {
    if (f.status === LeadFollowUpStatus.Suggested) {
      return 'st st--ai';
    }
    if (isFollowUpOverdue(f)) {
      return 'st st--due';
    }
    switch (f.status) {
      case LeadFollowUpStatus.Scheduled:
        return 'st st--scheduled';
      case LeadFollowUpStatus.Sent:
        return 'st st--sent';
      case LeadFollowUpStatus.Failed:
        return 'st st--failed';
      default:
        return 'st st--other';
    }
  }

  /** "+2 months" under the scheduled date, or "custom date" when a date was picked by hand. */
  scheduledNote(f: LeadFollowUp): string {
    if (f.status === LeadFollowUpStatus.Sent && f.sentAt) {
      return 'Sent';
    }
    return f.intervalMonths ? `+${f.intervalMonths} month${f.intervalMonths === 1 ? '' : 's'}` : 'date picked by hand';
  }

  /** A suggestion is confirmed on the lead, where the message is chosen; a date is changed there too. */
  openLead(f: LeadFollowUp, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/leads', f.leadId]);
  }

  sendNow(f: LeadFollowUp, event: Event): void {
    event.stopPropagation();
    this.confirm(
      {
        title: 'Send the follow-up now?',
        message: `${f.customerName || f.customerPhoneNumberE164} will get the "${f.messageTemplateName ?? 'follow-up'}" message straight away instead of waiting.`,
        confirmLabel: 'Send now',
      },
      () => this.run(f, this.followUps.sendNow(f.id), 'Follow-up sent.')
    );
  }

  /** Cancels a Scheduled or Failed follow-up, or dismisses the AI suggestion. */
  cancel(f: LeadFollowUp, event: Event): void {
    event.stopPropagation();
    const suggestion = isFollowUpSuggestion(f.status);
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
      () => this.run(f, this.followUps.cancel(f.id), suggestion ? 'Suggestion dismissed.' : 'Follow-up cancelled.')
    );
  }

  private run(f: LeadFollowUp, call: ReturnType<LeadFollowUpService['cancel']>, success: string): void {
    this.busyId = f.id;
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

  private loadSetting(): void {
    this.followUps.getSetting().subscribe({
      next: (setting) => {
        this.savedMonths = setting.months;
        this.monthsControl.setValue(setting.months);
        this.customChosen = !QUICK_MONTHS.includes(setting.months);
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

  private loadSummary(): void {
    this.followUps.getSummary().subscribe({
      next: (summary) => (this.summary = summary),
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }
}

import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import {
  FOLLOW_UP_HISTORY_STATUSES,
  LeadFollowUp,
  LeadFollowUpSummary,
  followUpStatusChipClass,
  followUpWaitLabel,
  isFollowUpActionable,
  isFollowUpOverdue,
} from '../../../core/models/lead-follow-up.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
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

  readonly displayedColumns = ['customer', 'status', 'dueAt', 'reason', 'template', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly historyStatuses = FOLLOW_UP_HISTORY_STATUSES;
  readonly statusClass = followUpStatusChipClass;
  readonly waitLabel = followUpWaitLabel;
  readonly actionable = isFollowUpActionable;
  readonly overdue = isFollowUpOverdue;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly viewControl = new FormControl<FollowUpView>('scheduled', { nonNullable: true });

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
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
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
    void this.router.navigate(['..', followUp.leadId], { relativeTo: this.route });
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

  cancel(followUp: LeadFollowUp, event: Event): void {
    event.stopPropagation();
    this.confirm(
      {
        title: 'Cancel this follow-up?',
        message: 'The reminder will not be sent. You can schedule a new one from the lead at any time.',
        confirmLabel: 'Cancel follow-up',
        cancelLabel: 'Keep it',
        destructive: true,
      },
      () => this.run(followUp, this.followUps.cancel(followUp.id), 'Follow-up cancelled.')
    );
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

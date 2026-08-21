import { ActivatedRoute } from '@angular/router';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, switchMap, takeUntil } from 'rxjs/operators';

import { Lead, LeadActivity, LeadStage, canEditLead, leadScoreChipClass, leadStageChipClass } from '../../../core/models/lead.model';
import { LeadService } from '../../../core/services/lead.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { User } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-lead-detail',
  templateUrl: './lead-detail.component.html',
  styleUrls: ['./lead-detail.component.scss'],
})
export class LeadDetailComponent implements OnInit, OnDestroy {
  readonly stageClass = leadStageChipClass;
  readonly scoreClass = leadScoreChipClass;
  readonly stages = Object.values(LeadStage);

  readonly attributesForm = this.fb.nonNullable.group({
    stage: [LeadStage.New as string],
    budget: ['', [Validators.maxLength(200)]],
    interest: ['', [Validators.maxLength(200)]],
    purchaseTimeline: ['', [Validators.maxLength(200)]],
  });
  readonly noteForm = this.fb.nonNullable.group({
    note: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  lead: Lead | null = null;
  loading = true;
  saving = false;
  addingNote = false;
  agents: User[] = [];

  activities: LeadActivity[] = [];
  activityPage: PagedResult<LeadActivity> = emptyPage<LeadActivity>();
  loadingActivities = false;
  private activityQuery: PagedQuery = { page: 1, pageSize: 20 };
  private readonly reloadActivities$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly leads: LeadService,
    private readonly users: UserService,
    private readonly notify: NotificationService,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.users.getPaged({ page: 1, pageSize: 100 }).subscribe((page) => (this.agents = page.items.filter((u) => u.isActive)));

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.loading = true;
          return this.leads.getById(params.get('id') ?? '');
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (lead) => {
          this.lead = lead;
          this.loading = false;
          this.attributesForm.patchValue({
            stage: lead.stage,
            budget: lead.budget ?? '',
            interest: lead.interest ?? '',
            purchaseTimeline: lead.purchaseTimeline ?? '',
          });
          this.activities = [];
          this.activityQuery = { page: 1, pageSize: 20 };
          this.reloadActivities$.next();
        },
        error: () => {
          this.lead = null;
          this.loading = false;
        },
      });

    this.reloadActivities$
      .pipe(
        switchMap(() => {
          if (!this.lead) {
            return [];
          }
          this.loadingActivities = true;
          return this.leads.getActivities(this.lead.id, this.activityQuery).pipe(finalize(() => (this.loadingActivities = false)));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => {
        this.activityPage = page;
        this.activities = this.activityQuery.page === 1 ? page.items : [...this.activities, ...page.items];
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canEdit(): boolean {
    return !!this.lead && canEditLead(this.lead.stage);
  }

  get hasMoreActivities(): boolean {
    return this.activityPage.page < this.activityPage.totalPages;
  }

  agentName(agentId: string | null): string {
    if (!agentId) {
      return 'Unassigned';
    }
    return this.agents.find((a) => a.id === agentId)?.fullName ?? 'Unknown agent';
  }

  /** LeadActivity.CreatedBy null marks an automatic, AI-driven write — distinct from a manual
   * agent action. */
  activityActor(activity: LeadActivity): string {
    return activity.createdBy ? this.agentName(activity.createdBy) : 'AI';
  }

  loadMoreActivities(): void {
    if (!this.lead || this.loadingActivities || !this.hasMoreActivities) {
      return;
    }
    this.activityQuery = { ...this.activityQuery, page: (this.activityQuery.page ?? 1) + 1 };
    this.reloadActivities$.next();
  }

  assign(agentId: string): void {
    if (!this.lead || !agentId) {
      return;
    }
    this.leads.assign(this.lead.id, { agentId }).subscribe({
      next: (lead) => {
        this.lead = lead;
        this.notify.success('Lead assigned.');
        this.activityQuery = { page: 1, pageSize: 20 };
        this.reloadActivities$.next();
      },
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  saveAttributes(): void {
    if (!this.lead || this.saving) {
      return;
    }
    const raw = this.attributesForm.getRawValue();
    this.saving = true;
    this.leads
      .update(this.lead.id, {
        stage: raw.stage,
        budget: raw.budget.trim() || null,
        interest: raw.interest.trim() || null,
        purchaseTimeline: raw.purchaseTimeline.trim() || null,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (lead) => {
          this.lead = lead;
          this.notify.success('Lead updated.');
          this.activityQuery = { page: 1, pageSize: 20 };
          this.reloadActivities$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  addNote(): void {
    if (!this.lead || this.noteForm.invalid || this.addingNote) {
      this.noteForm.markAllAsTouched();
      return;
    }
    this.addingNote = true;
    this.leads
      .addActivity(this.lead.id, { note: this.noteForm.getRawValue().note.trim() })
      .pipe(finalize(() => (this.addingNote = false)))
      .subscribe({
        next: () => {
          this.noteForm.reset({ note: '' });
          this.notify.success('Note added.');
          this.activityQuery = { page: 1, pageSize: 20 };
          this.reloadActivities$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }
}

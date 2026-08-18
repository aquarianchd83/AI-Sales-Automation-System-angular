import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import {
  CAMPAIGN_CUSTOMER_STATUS_ORDER,
  Campaign,
  CampaignAudienceMember,
  CampaignProgress,
  CampaignStep,
  campaignEndDate,
  campaignStatusChipClass,
  canDeleteCampaign,
  canEditCampaign,
  canEditSteps,
  canPauseCampaign,
  canResumeCampaign,
  canSetAudience,
  canStartCampaign,
  canStopCampaign,
  formatStepTypeName,
  isLastStep,
  nextStepNumber,
} from '../../../core/models/campaign.model';
import { CampaignAudienceDialogComponent } from '../campaign-audience-dialog/campaign-audience-dialog.component';
import { CampaignFormDialogComponent } from '../campaign-form-dialog/campaign-form-dialog.component';
import { CampaignService } from '../../../core/services/campaign.service';
import { CampaignStepDialogComponent, CampaignStepDialogData } from '../campaign-step-dialog/campaign-step-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-campaign-detail',
  templateUrl: './campaign-detail.component.html',
  styleUrls: ['./campaign-detail.component.scss'],
})
export class CampaignDetailComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) audiencePaginator?: MatPaginator;

  readonly customerStatusOrder = CAMPAIGN_CUSTOMER_STATUS_ORDER;
  readonly statusClass = campaignStatusChipClass;
  readonly audiencePageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly audienceSearchControl = new FormControl<string>('', { nonNullable: true });

  campaign: Campaign | null = null;
  progress: CampaignProgress | null = null;
  loading = true;
  loadingProgress = false;
  actionInFlight = false;

  audiencePage: PagedResult<CampaignAudienceMember> = emptyPage<CampaignAudienceMember>();
  loadingAudience = true;

  private audienceQuery: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reloadAudience$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly campaigns: CampaignService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.loading = true;
          return this.campaigns
            .getById(params.get('id') ?? '')
            .pipe(finalize(() => (this.loading = false)));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (campaign) => {
          this.campaign = campaign;
          this.loadProgress(campaign.id);
          this.reloadAudience$.next();
        },
        error: () => (this.campaign = null),
      });

    this.audienceSearchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.audienceQuery = { ...this.audienceQuery, page: 1, search: search || undefined };
        this.audiencePaginator?.firstPage();
        this.reloadAudience$.next();
      });

    this.reloadAudience$
      .pipe(
        switchMap(() => {
          if (!this.campaign) {
            return of(emptyPage<CampaignAudienceMember>(this.audienceQuery.pageSize));
          }
          this.loadingAudience = true;
          return this.campaigns.getAudience(this.campaign.id, this.audienceQuery).pipe(
            catchError(() => of(emptyPage<CampaignAudienceMember>(this.audienceQuery.pageSize))),
            finalize(() => (this.loadingAudience = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.audiencePage = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onAudiencePage(event: PageEvent): void {
    this.audienceQuery = { ...this.audienceQuery, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reloadAudience$.next();
  }

  audienceDisplayName(member: CampaignAudienceMember): string {
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
    return name || member.phoneNumberE164;
  }

  // ---- lifecycle guards, bound to the current campaign ----------------------------------

  get canEdit(): boolean {
    return !!this.campaign && canEditCampaign(this.campaign.status);
  }
  get canDelete(): boolean {
    return !!this.campaign && canDeleteCampaign(this.campaign.status);
  }
  get canEditStepsNow(): boolean {
    return !!this.campaign && canEditSteps(this.campaign.status);
  }
  get canSetAudienceNow(): boolean {
    return !!this.campaign && canSetAudience(this.campaign.status);
  }
  get canStart(): boolean {
    return !!this.campaign && canStartCampaign(this.campaign.status);
  }
  get canResume(): boolean {
    return !!this.campaign && canResumeCampaign(this.campaign.status);
  }
  get canPause(): boolean {
    return !!this.campaign && canPauseCampaign(this.campaign.status);
  }
  get canStop(): boolean {
    return !!this.campaign && canStopCampaign(this.campaign.status);
  }

  /** See campaignEndDate — null (renders as "—") until there's a start date to project from. */
  get endDate(): ReturnType<typeof campaignEndDate> {
    return this.campaign ? campaignEndDate(this.campaign) : null;
  }

  /** Steps in send order — the API already returns them sorted, this just guards against
   * relying on that implicitly if it ever doesn't. */
  get stepsInOrder(): CampaignStep[] {
    return [...(this.campaign?.steps ?? [])].sort((a, b) => a.stepNumber - b.stepNumber);
  }

  /**
   * The label for the one step addable right now — there is no upper bound on follow-ups,
   * so unlike a fixed set of slots this is never unavailable, only ever the next number in
   * sequence (Initial, then FollowUp1, FollowUp2, …). Steps must be attached in order — the
   * API 400s otherwise — so there is never more than one valid choice.
   */
  get nextStepLabel(): string {
    return formatStepTypeName(nextStepNumber(this.campaign?.steps ?? []));
  }

  /** A step can only be removed from the end of the sequence — the API 409s otherwise. */
  canRemoveStep(step: CampaignStep): boolean {
    if (!this.campaign) {
      return false;
    }
    return isLastStep(step.stepNumber, this.campaign.steps.map((s) => s.stepNumber));
  }

  progressCount(status: string): number {
    return this.progress?.byStatus[status] ?? 0;
  }

  // ---- actions ----------------------------------------------------------------------------

  edit(): void {
    if (!this.campaign) {
      return;
    }
    this.dialog
      .open(CampaignFormDialogComponent, {
        data: { mode: 'edit', campaign: this.campaign },
        width: '560px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload();
        }
      });
  }

  delete(): void {
    if (!this.campaign) {
      return;
    }
    const data: ConfirmDialogData = {
      title: `Delete "${this.campaign.name}"?`,
      message:
        'This cannot be undone. Deleting a Stopped campaign also permanently deletes its message history.',
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed && this.campaign) {
          this.campaigns.delete(this.campaign.id).subscribe(() => {
            this.notify.success('Campaign deleted.');
            void this.router.navigate(['/campaigns']);
          });
        }
      });
  }

  addStep(): void {
    if (!this.campaign || !this.canEditStepsNow) {
      return;
    }
    this.openStepDialog({ campaignId: this.campaign.id, existingSteps: this.campaign.steps });
  }

  editStep(step: CampaignStep): void {
    if (!this.campaign) {
      return;
    }
    this.openStepDialog({ campaignId: this.campaign.id, existingSteps: this.campaign.steps, step });
  }

  removeStep(step: CampaignStep): void {
    if (!this.campaign || !this.canRemoveStep(step)) {
      return;
    }
    const data: ConfirmDialogData = {
      title: `Remove the ${step.stepType} step?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed || !this.campaign) {
          return;
        }
        this.campaigns.removeStep(this.campaign.id, step.stepType).subscribe((campaign) => {
          this.campaign = campaign;
          this.notify.success('Step removed.');
        });
      });
  }

  setAudience(): void {
    if (!this.campaign) {
      return;
    }
    this.dialog
      .open(CampaignAudienceDialogComponent, {
        data: { campaign: this.campaign },
        width: '560px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.reload();
          this.reloadAudience$.next();
        }
      });
  }

  start(): void {
    this.runAction(() => this.campaigns.start(this.campaign!.id), 'Campaign started.');
  }

  resume(): void {
    this.runAction(() => this.campaigns.resume(this.campaign!.id), 'Campaign resumed.');
  }

  pause(): void {
    this.runAction(() => this.campaigns.pause(this.campaign!.id), 'Campaign paused.');
  }

  stop(): void {
    const data: ConfirmDialogData = {
      title: 'Stop this campaign?',
      message:
        'Every customer currently awaiting a follow-up is marked complete for this campaign. The campaign itself can be resumed afterwards, but those customers will not pick back up automatically.',
      confirmLabel: 'Stop',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.runAction(() => this.campaigns.stop(this.campaign!.id), 'Campaign stopped.');
        }
      });
  }

  refreshProgress(): void {
    if (this.campaign) {
      this.loadProgress(this.campaign.id);
    }
  }

  private runAction(call: () => Observable<Campaign>, successMessage: string): void {
    this.actionInFlight = true;
    call()
      .pipe(finalize(() => (this.actionInFlight = false)))
      .subscribe({
        next: (campaign) => {
          this.campaign = campaign;
          this.notify.success(successMessage);
          this.refreshProgress();
        },
        error: () => {
          // ErrorInterceptor toasts the specifics (e.g. which step is missing a template).
        },
      });
  }

  private openStepDialog(data: CampaignStepDialogData): void {
    this.dialog
      .open(CampaignStepDialogComponent, { data, width: '680px', disableClose: true })
      .afterClosed()
      .subscribe((campaign) => {
        if (campaign) {
          this.campaign = campaign;
        }
      });
  }

  private reload(): void {
    if (!this.campaign) {
      return;
    }
    this.loading = true;
    this.campaigns
      .getById(this.campaign.id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((campaign) => (this.campaign = campaign));
  }

  private loadProgress(campaignId: string): void {
    this.loadingProgress = true;
    this.campaigns
      .getProgress(campaignId)
      .pipe(finalize(() => (this.loadingProgress = false)))
      .subscribe({
        next: (progress) => (this.progress = progress),
        error: () => (this.progress = null),
      });
  }
}

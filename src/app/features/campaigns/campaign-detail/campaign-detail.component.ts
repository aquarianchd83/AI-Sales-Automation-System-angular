import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

import {
  CAMPAIGN_CUSTOMER_STATUS_ORDER,
  CAMPAIGN_STEP_TYPES_IN_ORDER,
  Campaign,
  CampaignProgress,
  CampaignStep,
  CampaignStepType,
  campaignStatusChipClass,
  canDeleteCampaign,
  canEditCampaign,
  canEditSteps,
  canPauseCampaign,
  canResumeCampaign,
  canSetAudience,
  canStartCampaign,
  canStopCampaign,
} from '../../../core/models/campaign.model';
import { CampaignAudienceDialogComponent } from '../campaign-audience-dialog/campaign-audience-dialog.component';
import { CampaignFormDialogComponent } from '../campaign-form-dialog/campaign-form-dialog.component';
import { CampaignService } from '../../../core/services/campaign.service';
import { CampaignStepDialogComponent, CampaignStepDialogData } from '../campaign-step-dialog/campaign-step-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-campaign-detail',
  templateUrl: './campaign-detail.component.html',
  styleUrls: ['./campaign-detail.component.scss'],
})
export class CampaignDetailComponent implements OnInit {
  readonly stepTypesInOrder = CAMPAIGN_STEP_TYPES_IN_ORDER;
  readonly customerStatusOrder = CAMPAIGN_CUSTOMER_STATUS_ORDER;
  readonly statusClass = campaignStatusChipClass;

  campaign: Campaign | null = null;
  progress: CampaignProgress | null = null;
  loading = true;
  loadingProgress = false;
  actionInFlight = false;

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
        })
      )
      .subscribe({
        next: (campaign) => {
          this.campaign = campaign;
          this.loadProgress(campaign.id);
        },
        error: () => (this.campaign = null),
      });
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

  missingStepTypes(): CampaignStepType[] {
    if (!this.campaign) {
      return [];
    }
    const present = new Set(this.campaign.steps.map((s) => s.stepType));
    return this.stepTypesInOrder.filter((type) => !present.has(type));
  }

  stepFor(type: string): CampaignStep | undefined {
    return this.campaign?.steps.find((s) => s.stepType === type);
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
      message: 'This cannot be undone.',
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

  addStep(preferredStepType: string): void {
    this.openStepDialog({
      campaignId: this.campaign!.id,
      existingStepTypes: this.campaign!.steps.map((s) => s.stepType),
      preferredStepType,
    });
  }

  editStep(step: CampaignStep): void {
    this.openStepDialog({
      campaignId: this.campaign!.id,
      existingStepTypes: this.campaign!.steps.map((s) => s.stepType),
      step,
    });
  }

  removeStep(step: CampaignStep): void {
    if (!this.campaign) {
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
        'Every customer currently awaiting a follow-up is marked complete for this campaign. A stopped campaign cannot be resumed.',
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

import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PlanSetupSummary, SetupVersionStatus, SetupVersionSummary } from '../../../core/models/application-setup.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformSetupService } from '../../../core/services/platform-setup.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** What each plan asks a Talent to set up, and which version of it is live. Add a question here and it appears in the wizard - no release. */
@Component({
  selector: 'app-platform-setup-plans',
  templateUrl: './platform-setup-plans.component.html',
  styleUrls: ['./platform-setup-plans.component.scss'],
})
export class PlatformSetupPlansComponent implements OnInit {
  plans: PlanSetupSummary[] = [];
  loading = true;
  busyPlanId: string | null = null;
  readonly columns = ['version', 'status', 'fields', 'applications', 'published', 'actions'];

  constructor(
    private readonly service: PlatformSetupService,
    private readonly dialog: MatDialog,
    private readonly router: Router,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.service
      .getPlans()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((plans) => (this.plans = plans));
  }

  draftOf(plan: PlanSetupSummary): SetupVersionSummary | undefined {
    return plan.versions.find((v) => v.status === 'Draft');
  }

  liveOf(plan: PlanSetupSummary): SetupVersionSummary | undefined {
    return plan.versions.find((v) => v.status === 'Published');
  }

  statusClass(status: SetupVersionStatus): string {
    return status === 'Published' ? 'ok' : status === 'Draft' ? 'warn' : 'neutral';
  }

  open(version: SetupVersionSummary): void {
    void this.router.navigate(['/platform/setup-plans/versions', version.id]);
  }

  /** The first version of a plan that has none, or the next draft of one that has. */
  startVersion(plan: PlanSetupSummary): void {
    this.busyPlanId = plan.planId;
    this.service
      .createVersion(plan.planId)
      .pipe(finalize(() => (this.busyPlanId = null)))
      .subscribe((created) => {
        this.notify.success(`Draft version ${created.versionNumber} created.`);
        void this.router.navigate(['/platform/setup-plans/versions', created.id]);
      });
  }

  deleteDraft(version: SetupVersionSummary, event: Event): void {
    event.stopPropagation();
    const data: ConfirmDialogData = {
      title: `Discard draft v${version.versionNumber}?`,
      message: 'The draft and its questions are deleted. Nothing live changes.',
      confirmLabel: 'Discard',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.service.deleteVersion(version.id).subscribe(() => {
            this.notify.success('Draft discarded.');
            this.load();
          });
        }
      });
  }
}

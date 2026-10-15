import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialog } from '@angular/material/dialog';
import { NEVER, of } from 'rxjs';

import { Campaign } from '../../../core/models/campaign.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { NotificationHubService } from '../../../core/services/notification-hub.service';
import { NotificationService } from '../../../core/services/notification.service';
import { EMBEDDED_IN_ONBOARDING } from '../../../core/tokens/embedded-in-onboarding';
import { AuthService } from '../../../core/services/auth.service';
import { SharedModule } from '../../../shared/shared.module';
import { TenantJobsDialogComponent } from '../../../shared/components/tenant-jobs-dialog/tenant-jobs-dialog.component';
import { CampaignListComponent } from './campaign-list.component';

/** The Campaigns screen shown inside onboarding's "Create Campaign" step: just the campaigns - the job schedules
 * (which only exist once a campaign does) stay on the full Campaigns page. */
describe('CampaignListComponent inside onboarding', () => {
  function render(embedded: boolean): { root: HTMLElement; dialog: jasmine.SpyObj<MatDialog> } {
    const dialog = jasmine.createSpyObj<MatDialog>("MatDialog", ["open"]);
    const campaigns = jasmine.createSpyObj<CampaignService>('CampaignService', ['getPaged']);
    campaigns.getPaged.and.returnValue(of(emptyPage<Campaign>()));
    const hub = jasmine.createSpyObj<NotificationHubService>('NotificationHubService', ['jobFinished', 'jobStarted']);
    hub.jobFinished.and.returnValue(NEVER);
    hub.jobStarted.and.returnValue(NEVER);

    TestBed.configureTestingModule({
      declarations: [CampaignListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: CampaignService, useValue: campaigns },
        { provide: NotificationHubService, useValue: hub },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
        { provide: AuthService, useValue: { currentUser$: NEVER, hasAnyRole: () => true } },
        { provide: MatDialog, useValue: dialog },
        ...(embedded ? [{ provide: EMBEDDED_IN_ONBOARDING, useValue: true }] : []),
      ],
    });
    const fixture = TestBed.createComponent(CampaignListComponent);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, dialog };
  }

  it('leaves the campaign jobs out', () => {
    const { root } = render(true);

    expect(root.querySelector('.jobs-button')).toBeNull();
    expect(root.querySelector('app-tenant-job-list')).toBeNull();
    expect(root.querySelector('.table-card')).toBeTruthy();
  });

  it('offers the campaign jobs as a Jobs button on the full Campaigns page, not inline', () => {
    const { root } = render(false);

    expect(root.querySelector('.table-card')).toBeTruthy();
    expect(root.querySelector('.jobs-button')?.textContent).toContain('Jobs');
    expect(root.querySelector('app-tenant-job-list')).toBeNull();
  });

  it('opens the campaign jobs in a dialog', () => {
    const { root, dialog } = render(false);

    (root.querySelector('.jobs-button') as HTMLButtonElement).click();

    expect(dialog.open).toHaveBeenCalledWith(
      TenantJobsDialogComponent,
      jasmine.objectContaining({ data: jasmine.objectContaining({ title: 'Campaign jobs' }) })
    );
  });
});

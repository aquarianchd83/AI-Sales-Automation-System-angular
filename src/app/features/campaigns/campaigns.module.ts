import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CampaignAudienceDialogComponent } from './campaign-audience-dialog/campaign-audience-dialog.component';
import { CampaignDetailComponent } from './campaign-detail/campaign-detail.component';
import { CampaignFormDialogComponent } from './campaign-form-dialog/campaign-form-dialog.component';
import { CampaignListComponent } from './campaign-list/campaign-list.component';
import { CampaignStepDialogComponent } from './campaign-step-dialog/campaign-step-dialog.component';
import { RunJobsResultDialogComponent } from './run-jobs-result-dialog/run-jobs-result-dialog.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: CampaignListComponent },
  { path: ':id', component: CampaignDetailComponent },
];

@NgModule({
  declarations: [
    CampaignListComponent,
    CampaignDetailComponent,
    CampaignFormDialogComponent,
    CampaignStepDialogComponent,
    CampaignAudienceDialogComponent,
    RunJobsResultDialogComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class CampaignsModule {}

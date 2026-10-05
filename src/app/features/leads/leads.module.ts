import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LeadDetailComponent } from './lead-detail/lead-detail.component';
import { LeadFollowUpListComponent } from './lead-follow-up-list/lead-follow-up-list.component';
import { LeadFollowUpPanelComponent } from './lead-follow-up-panel/lead-follow-up-panel.component';
import { LeadListComponent } from './lead-list/lead-list.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: LeadListComponent },
  // Before ':id' - otherwise 'follow-ups' would be read as a lead id.
  { path: 'follow-ups', component: LeadFollowUpListComponent },
  { path: ':id', component: LeadDetailComponent },
];

@NgModule({
  declarations: [LeadListComponent, LeadDetailComponent, LeadFollowUpListComponent, LeadFollowUpPanelComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class LeadsModule {}

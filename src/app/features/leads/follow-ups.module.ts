import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LeadFollowUpListComponent } from './lead-follow-up-list/lead-follow-up-list.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: LeadFollowUpListComponent }];

/** The Follow-ups page: its own menu entry under Engage, though the follow-ups themselves belong to leads. */
@NgModule({
  declarations: [LeadFollowUpListComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class FollowUpsModule {}

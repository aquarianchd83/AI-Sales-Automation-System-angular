import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LeadDetailComponent } from './lead-detail/lead-detail.component';
import { LeadListComponent } from './lead-list/lead-list.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: LeadListComponent },
  { path: ':id', component: LeadDetailComponent },
];

@NgModule({
  declarations: [LeadListComponent, LeadDetailComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class LeadsModule {}

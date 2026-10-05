import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { SetupSharedModule } from '../setup-shared/setup-shared.module';
import { ApplicationDetailComponent } from './application-detail/application-detail.component';
import { ApplicationListComponent } from './application-list/application-list.component';
import { ApplicationSetupPageComponent } from './application-setup-page/application-setup-page.component';
import { ChangePlanDialogComponent } from './change-plan-dialog/change-plan-dialog.component';
import { NewApplicationDialogComponent } from './new-application-dialog/new-application-dialog.component';

const routes: Routes = [
  { path: '', component: ApplicationListComponent },
  { path: ':id', component: ApplicationDetailComponent },
  { path: ':id/setup', component: ApplicationSetupPageComponent },
];

@NgModule({
  declarations: [
    ApplicationListComponent,
    ApplicationDetailComponent,
    ApplicationSetupPageComponent,
    NewApplicationDialogComponent,
    ChangePlanDialogComponent,
  ],
  imports: [SharedModule, SetupSharedModule, RouterModule.forChild(routes)],
})
export class ApplicationsModule {}

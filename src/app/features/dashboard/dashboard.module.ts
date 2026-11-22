import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { UnlockMoreComponent } from './unlock-more/unlock-more.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: DashboardComponent }];

@NgModule({
  declarations: [DashboardComponent, UnlockMoreComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class DashboardModule {}

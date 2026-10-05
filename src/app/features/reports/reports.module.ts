import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { ReportsComponent } from './reports.component';
import { RevenueReportComponent } from './revenue-report/revenue-report.component';

const routes: Routes = [{ path: '', component: ReportsComponent }];

@NgModule({
  declarations: [ReportsComponent, RevenueReportComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ReportsModule {}

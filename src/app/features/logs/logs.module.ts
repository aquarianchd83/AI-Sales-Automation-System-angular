import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LogListComponent } from './log-list/log-list.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: LogListComponent }];

@NgModule({
  declarations: [LogListComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class LogsModule {}

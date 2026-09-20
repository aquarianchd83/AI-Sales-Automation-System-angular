import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AgentPerformancePageComponent } from './agent-performance-page/agent-performance-page.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: AgentPerformancePageComponent }];

@NgModule({
  declarations: [AgentPerformancePageComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class AgentPerformanceModule {}

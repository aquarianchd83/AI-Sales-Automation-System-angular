import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { StudioActivityComponent } from './studio-activity/studio-activity.component';

const routes: Routes = [{ path: '', component: StudioActivityComponent }];

@NgModule({
  declarations: [StudioActivityComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ContentStudioModule {}

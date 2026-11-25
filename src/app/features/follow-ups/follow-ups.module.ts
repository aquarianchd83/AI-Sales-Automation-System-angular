import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FollowUpsComponent } from './follow-ups.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: FollowUpsComponent }];

/** The Follow-ups page: its own menu entry under Engage. */
@NgModule({
  declarations: [FollowUpsComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class FollowUpsModule {}

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { ImpersonateSessionComponent } from './impersonate-session.component';

const routes: Routes = [{ path: '', component: ImpersonateSessionComponent }];

@NgModule({
  declarations: [ImpersonateSessionComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ImpersonateSessionModule {}

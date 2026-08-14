import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChangePasswordComponent } from './change-password/change-password.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: ChangePasswordComponent }];

@NgModule({
  declarations: [ChangePasswordComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class AccountModule {}

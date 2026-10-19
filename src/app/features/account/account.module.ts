import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChangePasswordComponent } from './change-password/change-password.component';
import { SharedModule } from '../../shared/shared.module';

/** No role gate anywhere here: every signed-in user has their own account to maintain, a PlatformSuperAdmin
 * included — see the backend's AccountController doc comment. */
const routes: Routes = [
  { path: 'change-password', component: ChangePasswordComponent },
  { path: '', pathMatch: 'full', redirectTo: 'change-password' },
];

@NgModule({
  declarations: [ChangePasswordComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class AccountModule {}

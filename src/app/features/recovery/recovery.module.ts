import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';

const routes: Routes = [
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
];

/** The sign-in recovery pages. Mounted at /recover with no guard: the people using them cannot sign in (or, for the verify link, may or may
 * not be). The emailed links use the short /reset-password and /verify-email paths, which app-routing redirects here. */
@NgModule({
  declarations: [ForgotPasswordComponent, ResetPasswordComponent, VerifyEmailComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class RecoveryModule {}

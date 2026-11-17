import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PrivacyComponent } from './privacy.component';

const routes: Routes = [{ path: '', component: PrivacyComponent }];

/** Public privacy policy. Mounted at /privacy with no guard: static content, no session and no API calls. */
@NgModule({
  declarations: [PrivacyComponent],
  imports: [RouterModule.forChild(routes)],
})
export class PrivacyModule {}

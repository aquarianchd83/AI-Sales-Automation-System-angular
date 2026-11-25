import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TermsComponent } from './terms.component';

const routes: Routes = [{ path: '', component: TermsComponent }];

/** Public Terms and Conditions. Mounted at /terms with no guard: static content, no session and no API calls. */
@NgModule({
  declarations: [TermsComponent],
  imports: [RouterModule.forChild(routes)],
})
export class TermsModule {}

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { PublicConsentComponent } from './public-consent.component';

const routes: Routes = [{ path: '', component: PublicConsentComponent }];

/** The page a customer reaches from the link in the SMS. Mounted at /consent/:token with no guard - the customer has no account. */
@NgModule({
  declarations: [PublicConsentComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class PublicConsentModule {}

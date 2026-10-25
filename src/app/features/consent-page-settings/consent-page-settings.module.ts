import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { ConsentPageSettingsComponent } from './consent-page-settings.component';

const routes: Routes = [{ path: '', component: ConsentPageSettingsComponent }];

/** WhatsApp Consent Page Settings: the tenant's own product information and consent wording. Admin only. */
@NgModule({
  declarations: [ConsentPageSettingsComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ConsentPageSettingsModule {}

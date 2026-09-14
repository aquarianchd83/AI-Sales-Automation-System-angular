import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { BillingListComponent } from './billing-list/billing-list.component';

const routes: Routes = [{ path: '', component: BillingListComponent }];

@NgModule({
  declarations: [BillingListComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class BillingModule {}

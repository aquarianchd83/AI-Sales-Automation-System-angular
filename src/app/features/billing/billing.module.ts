import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { BillingListComponent } from './billing-list/billing-list.component';
import { RefundRequestDialogComponent } from './refund-request-dialog/refund-request-dialog.component';
import { TestNotificationsComponent } from './test-notifications/test-notifications.component';
import { WalletComponent } from './wallet/wallet.component';

const routes: Routes = [
  { path: '', component: BillingListComponent },
  { path: 'wallet', component: WalletComponent },
  { path: 'notifications/test', component: TestNotificationsComponent },
];

@NgModule({
  declarations: [BillingListComponent, WalletComponent, RefundRequestDialogComponent, TestNotificationsComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class BillingModule {}

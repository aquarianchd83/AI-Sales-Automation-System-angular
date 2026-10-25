import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { DemoSmsOutboxComponent } from './demo-sms-outbox.component';

const routes: Routes = [{ path: '', component: DemoSmsOutboxComponent }];

/** Demo only: the consent links in the SMS messages the simulated provider "sent". */
@NgModule({
  declarations: [DemoSmsOutboxComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class DemoSmsOutboxModule {}

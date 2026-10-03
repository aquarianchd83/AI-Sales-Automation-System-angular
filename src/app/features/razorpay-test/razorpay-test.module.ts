import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { RazorpayTestPageComponent } from './razorpay-test-page.component';

/** The platform's Razorpay test page. Lazy and self-contained: it is not part of tenant billing. */
@NgModule({
  declarations: [RazorpayTestPageComponent],
  imports: [SharedModule, RouterModule.forChild([{ path: '', component: RazorpayTestPageComponent }])],
})
export class RazorpayTestModule {}

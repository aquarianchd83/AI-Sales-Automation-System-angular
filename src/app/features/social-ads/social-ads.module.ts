import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { SocialAdsComponent } from './social-ads.component';

const routes: Routes = [{ path: '', component: SocialAdsComponent }];

@NgModule({
  declarations: [SocialAdsComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class SocialAdsModule {}

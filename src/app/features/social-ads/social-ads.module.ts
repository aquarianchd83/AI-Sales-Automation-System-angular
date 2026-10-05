import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { SocialAdsComponent } from './social-ads.component';
import { SocialAdsGuideDialogComponent } from './social-ads-guide-dialog/social-ads-guide-dialog.component';

const routes: Routes = [{ path: '', component: SocialAdsComponent }];

@NgModule({
  declarations: [SocialAdsComponent, SocialAdsGuideDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class SocialAdsModule {}

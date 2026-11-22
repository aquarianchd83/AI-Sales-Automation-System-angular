import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { FeaturePreviewComponent } from './feature-preview.component';

const routes: Routes = [{ path: ':feature', component: FeaturePreviewComponent }];

@NgModule({
  declarations: [FeaturePreviewComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class FeaturePreviewModule {}

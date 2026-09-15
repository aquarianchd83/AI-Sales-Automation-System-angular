import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { BusinessProfileComponent } from './business-profile.component';

const routes: Routes = [{ path: '', component: BusinessProfileComponent }];

@NgModule({
  declarations: [BusinessProfileComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class BusinessProfileModule {}

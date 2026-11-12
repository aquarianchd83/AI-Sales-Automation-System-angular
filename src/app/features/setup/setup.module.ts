import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { SetupComponent } from './setup.component';

const routes: Routes = [{ path: '', component: SetupComponent }];

@NgModule({
  declarations: [SetupComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class SetupModule {}

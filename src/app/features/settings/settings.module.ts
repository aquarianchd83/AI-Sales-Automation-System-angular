import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { SettingsListComponent } from './settings-list/settings-list.component';

const routes: Routes = [{ path: '', component: SettingsListComponent }];

@NgModule({
  declarations: [SettingsListComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class SettingsModule {}

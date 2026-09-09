import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { TenantSettingsListComponent } from './tenant-settings-list/tenant-settings-list.component';

const routes: Routes = [{ path: '', component: TenantSettingsListComponent }];

@NgModule({
  declarations: [TenantSettingsListComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class TenantSettingsModule {}

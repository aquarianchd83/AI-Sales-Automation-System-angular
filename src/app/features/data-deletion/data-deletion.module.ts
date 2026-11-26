import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DataDeletionComponent } from './data-deletion.component';

const routes: Routes = [{ path: '', component: DataDeletionComponent }];

/** Public data deletion instructions. Mounted at /data-deletion with no guard: static content, no session and no API calls. */
@NgModule({
  declarations: [DataDeletionComponent],
  imports: [RouterModule.forChild(routes)],
})
export class DataDeletionModule {}

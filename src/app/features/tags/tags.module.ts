import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { TagFormDialogComponent } from './tag-form-dialog/tag-form-dialog.component';
import { TagListComponent } from './tag-list/tag-list.component';

const routes: Routes = [{ path: '', component: TagListComponent }];

@NgModule({
  declarations: [TagListComponent, TagFormDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class TagsModule {}

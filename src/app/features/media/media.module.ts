import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MediaListComponent } from './media-list/media-list.component';
import { MediaUploadDialogComponent } from './media-upload-dialog/media-upload-dialog.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: MediaListComponent }];

@NgModule({
  declarations: [MediaListComponent, MediaUploadDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class MediaModule {}

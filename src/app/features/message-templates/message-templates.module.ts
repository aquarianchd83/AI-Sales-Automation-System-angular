import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { TemplateFormDialogComponent } from './template-form-dialog/template-form-dialog.component';
import { TemplateListComponent } from './template-list/template-list.component';

const routes: Routes = [{ path: '', component: TemplateListComponent }];

@NgModule({
  declarations: [TemplateListComponent, TemplateFormDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class MessageTemplatesModule {}

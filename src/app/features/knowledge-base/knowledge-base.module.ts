import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ArticleFormDialogComponent } from './article-form-dialog/article-form-dialog.component';
import { ArticleListComponent } from './article-list/article-list.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: ArticleListComponent }];

@NgModule({
  declarations: [ArticleListComponent, ArticleFormDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class KnowledgeBaseModule {}

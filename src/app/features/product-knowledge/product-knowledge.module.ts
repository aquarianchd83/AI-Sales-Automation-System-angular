import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { KnowledgeSourcesComponent } from './knowledge-sources/knowledge-sources.component';
import { ProductAnswersComponent } from './product-answers/product-answers.component';
import { PublishedKnowledgeComponent } from './published-knowledge/published-knowledge.component';

// Product knowledge: the tenant's sources (phase 2) and the answers drafted from them (phase 3). The verification, publish and knowledge-file screens join this module in later phases.
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sources' },
  { path: 'sources', component: KnowledgeSourcesComponent },
  { path: 'answers', component: ProductAnswersComponent },
  { path: 'versions', component: PublishedKnowledgeComponent },
];

@NgModule({
  declarations: [KnowledgeSourcesComponent, ProductAnswersComponent, PublishedKnowledgeComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ProductKnowledgeModule {}

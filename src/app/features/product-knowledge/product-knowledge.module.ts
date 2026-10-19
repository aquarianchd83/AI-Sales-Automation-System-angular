import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { KnowledgeSourcesComponent } from './knowledge-sources/knowledge-sources.component';

// Product knowledge: the tenant's sources (phase 2). The review, publish and knowledge-file screens join this module in later phases.
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sources' },
  { path: 'sources', component: KnowledgeSourcesComponent },
];

@NgModule({
  declarations: [KnowledgeSourcesComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ProductKnowledgeModule {}

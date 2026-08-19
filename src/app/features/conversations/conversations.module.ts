import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ConversationDetailComponent } from './conversation-detail/conversation-detail.component';
import { ConversationListComponent } from './conversation-list/conversation-list.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: ConversationListComponent },
  { path: ':id', component: ConversationDetailComponent },
];

@NgModule({
  declarations: [ConversationListComponent, ConversationDetailComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ConversationsModule {}

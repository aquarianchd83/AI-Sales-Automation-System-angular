import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/auth.guard';
import { STUDIO_CONTENT_ROLES } from '../../core/models/content-studio.model';
import { TENANT_ADMIN_ROLES } from '../../core/models/user.model';
import { SharedModule } from '../../shared/shared.module';
import { StudioActivityComponent } from './studio-activity/studio-activity.component';
import { StudioFactsComponent } from './studio-facts/studio-facts.component';
import { StudioQuestionnaireComponent } from './studio-questionnaire/studio-questionnaire.component';
import { StudioReadinessComponent } from './studio-readiness/studio-readiness.component';
import { StudioStoriesComponent } from './studio-stories/studio-stories.component';
import { StudioStoryDetailComponent } from './studio-story-detail/studio-story-detail.component';
import { StudioStoryNewComponent } from './studio-story-new/studio-story-new.component';

// The charge history is billing information (Admin only); the questionnaire, facts and readiness are for Admins and Sales Managers.
const routes: Routes = [
  { path: '', pathMatch: 'full', component: StudioActivityComponent, canActivate: [roleGuard], data: { roles: TENANT_ADMIN_ROLES } },
  { path: 'questionnaire', component: StudioQuestionnaireComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  { path: 'facts', component: StudioFactsComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  { path: 'readiness', component: StudioReadinessComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  { path: 'stories', component: StudioStoriesComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  // The New story fields get a page of their own, with a way back to the list.
  { path: 'stories/new', component: StudioStoryNewComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  // One requested video on its own page (the request's id): its status, script and video.
  { path: 'stories/:id', component: StudioStoryDetailComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
];

@NgModule({
  declarations: [StudioActivityComponent, StudioQuestionnaireComponent, StudioFactsComponent, StudioReadinessComponent, StudioStoriesComponent, StudioStoryNewComponent, StudioStoryDetailComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ContentStudioModule {}

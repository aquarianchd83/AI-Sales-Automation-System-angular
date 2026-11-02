import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/auth.guard';
import { STUDIO_CONTENT_ROLES } from '../../core/models/content-studio.model';
import { TENANT_ADMIN_ROLES } from '../../core/models/user.model';
import { SharedModule } from '../../shared/shared.module';
import { StudioActivityComponent } from './studio-activity/studio-activity.component';
import { StudioAnalyticsComponent } from './studio-analytics/studio-analytics.component';
import { StudioConnectionsComponent } from './studio-connections/studio-connections.component';
import { StudioPlannerComponent } from './studio-planner/studio-planner.component';
import { StudioFactsComponent } from './studio-facts/studio-facts.component';
import { StudioQuestionnaireComponent } from './studio-questionnaire/studio-questionnaire.component';
import { StudioReadinessComponent } from './studio-readiness/studio-readiness.component';

// The charge history is billing information (Admin only); the questionnaire, facts and readiness are for Admins and Sales Managers.
const routes: Routes = [
  { path: '', pathMatch: 'full', component: StudioActivityComponent, canActivate: [roleGuard], data: { roles: TENANT_ADMIN_ROLES } },
  { path: 'questionnaire', component: StudioQuestionnaireComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  { path: 'facts', component: StudioFactsComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  { path: 'analytics', component: StudioAnalyticsComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  { path: 'connections', component: StudioConnectionsComponent, canActivate: [roleGuard], data: { roles: TENANT_ADMIN_ROLES } },
  { path: 'planner', component: StudioPlannerComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
  { path: 'readiness', component: StudioReadinessComponent, canActivate: [roleGuard], data: { roles: STUDIO_CONTENT_ROLES } },
];

@NgModule({
  declarations: [StudioActivityComponent, StudioQuestionnaireComponent, StudioFactsComponent, StudioReadinessComponent, StudioPlannerComponent, StudioConnectionsComponent, StudioAnalyticsComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ContentStudioModule {}

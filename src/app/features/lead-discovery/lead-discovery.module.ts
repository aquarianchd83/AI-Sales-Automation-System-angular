import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { roleGuard } from '../../core/guards/auth.guard';
import { TENANT_ADMIN_ROLES } from '../../core/models/user.model';
import { SharedModule } from '../../shared/shared.module';
import { AutoCampaignHistoryListComponent } from './auto-campaign-history-list/auto-campaign-history-list.component';
import { DiscoveredLeadDetailDialogComponent } from './discovered-lead-detail-dialog/discovered-lead-detail-dialog.component';
import { DiscoveredLeadListComponent } from './discovered-lead-list/discovered-lead-list.component';
import { DiscoveryRunListComponent } from './discovery-run-list/discovery-run-list.component';
import { LeadDiscoveryProfileComponent } from './lead-discovery-profile/lead-discovery-profile.component';

const routes: Routes = [
  { path: '', component: DiscoveredLeadListComponent },
  {
    // The API only lets a tenant Admin read or change the profile — a run spends the tenant's AI credit.
    path: 'profile',
    component: LeadDiscoveryProfileComponent,
    canActivate: [roleGuard],
    data: { roles: TENANT_ADMIN_ROLES },
  },
  {
    // Spend history - Admin only, same gate as the profile and GET /lead-discovery/runs itself.
    path: 'runs',
    component: DiscoveryRunListComponent,
    canActivate: [roleGuard],
    data: { roles: TENANT_ADMIN_ROLES },
  },
  {
    path: 'auto-campaign-history',
    component: AutoCampaignHistoryListComponent,
    canActivate: [roleGuard],
    data: { roles: TENANT_ADMIN_ROLES },
  },
];

@NgModule({
  declarations: [
    DiscoveredLeadListComponent,
    DiscoveredLeadDetailDialogComponent,
    LeadDiscoveryProfileComponent,
    DiscoveryRunListComponent,
    AutoCampaignHistoryListComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class LeadDiscoveryModule {}

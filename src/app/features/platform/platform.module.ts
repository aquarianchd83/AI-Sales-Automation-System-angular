import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { PlatformAnnouncementFormDialogComponent } from './platform-announcement-form-dialog/platform-announcement-form-dialog.component';
import { PlatformAnnouncementListComponent } from './platform-announcement-list/platform-announcement-list.component';
import { PlatformAuditLogComponent } from './platform-audit-log/platform-audit-log.component';
import { PlatformBillingComponent } from './platform-billing/platform-billing.component';
import { PlatformDashboardComponent } from './platform-dashboard/platform-dashboard.component';
import { PlatformShellComponent } from './platform-shell/platform-shell.component';
import { PlatformTenantAiConfigDialogComponent } from './platform-tenant-ai-config-dialog/platform-tenant-ai-config-dialog.component';
import { PlatformTenantConfigOverridesDialogComponent } from './platform-tenant-config-overrides-dialog/platform-tenant-config-overrides-dialog.component';
import { PlatformTenantDetailComponent } from './platform-tenant-detail/platform-tenant-detail.component';
import { PlatformTenantFormDialogComponent } from './platform-tenant-form-dialog/platform-tenant-form-dialog.component';
import { PlatformTenantListComponent } from './platform-tenant-list/platform-tenant-list.component';
import { PlatformTenantWhatsAppConfigDialogComponent } from './platform-tenant-whatsapp-config-dialog/platform-tenant-whatsapp-config-dialog.component';
import { PlatformUsageComponent } from './platform-usage/platform-usage.component';
import { PlatformUserSearchComponent } from './platform-user-search/platform-user-search.component';
import { PlatformWhatsAppConnectionsComponent } from './platform-whatsapp-connections/platform-whatsapp-connections.component';

const routes: Routes = [
  {
    path: '',
    component: PlatformShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: PlatformDashboardComponent },
      { path: 'tenants', component: PlatformTenantListComponent },
      { path: 'tenants/:id', component: PlatformTenantDetailComponent },
      { path: 'billing', component: PlatformBillingComponent },
      { path: 'usage', component: PlatformUsageComponent },
      { path: 'whatsapp-connections', component: PlatformWhatsAppConnectionsComponent },
      { path: 'users', component: PlatformUserSearchComponent },
      { path: 'audit-log', component: PlatformAuditLogComponent },
      { path: 'announcements', component: PlatformAnnouncementListComponent },
    ],
  },
];

@NgModule({
  declarations: [
    PlatformShellComponent,
    PlatformDashboardComponent,
    PlatformTenantListComponent,
    PlatformTenantDetailComponent,
    PlatformTenantFormDialogComponent,
    PlatformTenantWhatsAppConfigDialogComponent,
    PlatformTenantAiConfigDialogComponent,
    PlatformTenantConfigOverridesDialogComponent,
    PlatformBillingComponent,
    PlatformUsageComponent,
    PlatformWhatsAppConnectionsComponent,
    PlatformUserSearchComponent,
    PlatformAuditLogComponent,
    PlatformAnnouncementListComponent,
    PlatformAnnouncementFormDialogComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class PlatformModule {}

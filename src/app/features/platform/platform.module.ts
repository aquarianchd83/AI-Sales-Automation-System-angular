import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { PlatformAnnouncementFormDialogComponent } from './platform-announcement-form-dialog/platform-announcement-form-dialog.component';
import { PlatformAnnouncementListComponent } from './platform-announcement-list/platform-announcement-list.component';
import { PlatformAuditLogComponent } from './platform-audit-log/platform-audit-log.component';
import { PlatformBillingComponent } from './platform-billing/platform-billing.component';
import { PlatformDashboardComponent } from './platform-dashboard/platform-dashboard.component';
import { PlatformPaymentListComponent } from './platform-payment-list/platform-payment-list.component';
import { PlatformJobScheduleDialogComponent } from './platform-job-schedule-dialog/platform-job-schedule-dialog.component';
import { PlatformJobsComponent } from './platform-jobs/platform-jobs.component';
import { PlatformLogsComponent } from './platform-logs/platform-logs.component';
import { CountryPriceEditorComponent } from './country-price-editor/country-price-editor.component';
import { PlatformConfigurationComponent } from './platform-configuration/platform-configuration.component';
import { PlatformCreditPackFormDialogComponent } from './platform-credit-pack-form-dialog/platform-credit-pack-form-dialog.component';
import { PlatformPlanFormDialogComponent } from './platform-plan-form-dialog/platform-plan-form-dialog.component';
import { PlatformQuotaAdjustDialogComponent } from './platform-quota-adjust-dialog/platform-quota-adjust-dialog.component';
import { PlatformRefundListComponent } from './platform-refund-list/platform-refund-list.component';
import { PlatformRefundReviewDialogComponent } from './platform-refund-review-dialog/platform-refund-review-dialog.component';
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
      { path: 'payments', component: PlatformPaymentListComponent },
      { path: 'configuration', component: PlatformConfigurationComponent },
      // The old usage-invoice screen was retired with prepaid billing.
      { path: 'invoices', pathMatch: 'full', redirectTo: 'payments' },
      { path: 'invoices/:id', redirectTo: 'payments' },
      { path: 'refunds', component: PlatformRefundListComponent },
      { path: 'whatsapp-connections', component: PlatformWhatsAppConnectionsComponent },
      { path: 'jobs', component: PlatformJobsComponent },
      { path: 'users', component: PlatformUserSearchComponent },
      { path: 'audit-log', component: PlatformAuditLogComponent },
      { path: 'logs', component: PlatformLogsComponent },
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
    PlatformPlanFormDialogComponent,
    PlatformCreditPackFormDialogComponent,
    CountryPriceEditorComponent,
    PlatformUsageComponent,
    PlatformPaymentListComponent,
    PlatformConfigurationComponent,
    PlatformRefundListComponent,
    PlatformRefundReviewDialogComponent,
    PlatformQuotaAdjustDialogComponent,
    PlatformWhatsAppConnectionsComponent,
    PlatformJobsComponent,
    PlatformJobScheduleDialogComponent,
    PlatformUserSearchComponent,
    PlatformAuditLogComponent,
    PlatformLogsComponent,
    PlatformAnnouncementListComponent,
    PlatformAnnouncementFormDialogComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class PlatformModule {}

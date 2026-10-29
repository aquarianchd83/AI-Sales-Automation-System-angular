import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { PlatformAnnouncementFormDialogComponent } from './platform-announcement-form-dialog/platform-announcement-form-dialog.component';
import { PlatformAnnouncementListComponent } from './platform-announcement-list/platform-announcement-list.component';
import { PlatformAwsSettingsComponent } from './platform-aws-settings/platform-aws-settings.component';
import { PlatformDeliverySettingsComponent } from './platform-delivery-settings/platform-delivery-settings.component';
import { PlatformAiPolicyComponent } from './platform-ai-policy/platform-ai-policy.component';
import { PlatformProductSourcesComponent } from './platform-product-sources/platform-product-sources.component';
import { PlatformIntegrationSettingsComponent } from './platform-integration-settings/platform-integration-settings.component';
import { PlatformAuditLogComponent } from './platform-audit-log/platform-audit-log.component';
import { PlatformBillingComponent } from './platform-billing/platform-billing.component';
import { PlatformDashboardComponent } from './platform-dashboard/platform-dashboard.component';
import { PlatformPaymentListComponent } from './platform-payment-list/platform-payment-list.component';
import { PlatformJobScheduleDialogComponent } from './platform-job-schedule-dialog/platform-job-schedule-dialog.component';
import { PlatformJobsComponent } from './platform-jobs/platform-jobs.component';
import { PlatformEmbeddingSettingsComponent } from './platform-embedding-settings/platform-embedding-settings.component';
import { PlatformKnowledgeComponent } from './platform-knowledge/platform-knowledge.component';
import { PlatformKnowledgeDeprecateDialogComponent } from './platform-knowledge-deprecate-dialog/platform-knowledge-deprecate-dialog.component';
import { PlatformKnowledgeFormDialogComponent } from './platform-knowledge-form-dialog/platform-knowledge-form-dialog.component';
import { PlatformLogsComponent } from './platform-logs/platform-logs.component';
import { CountryPriceEditorComponent } from './country-price-editor/country-price-editor.component';
import { PlatformConfigurationComponent } from './platform-configuration/platform-configuration.component';
import { PlatformCreditPackFormDialogComponent } from './platform-credit-pack-form-dialog/platform-credit-pack-form-dialog.component';
import { PlatformPlanEditorComponent } from './platform-plan-editor/platform-plan-editor.component';
import { PlatformQuotaAdjustDialogComponent } from './platform-quota-adjust-dialog/platform-quota-adjust-dialog.component';
import { PlatformRefundListComponent } from './platform-refund-list/platform-refund-list.component';
import { PlatformRefundReviewDialogComponent } from './platform-refund-review-dialog/platform-refund-review-dialog.component';
import { PlatformShellComponent } from './platform-shell/platform-shell.component';
import { PlatformTicketsComponent } from './platform-tickets/platform-tickets.component';
import { PlatformStudioQuestionnairesComponent } from './platform-studio-questionnaires/platform-studio-questionnaires.component';
import { PlatformTenantConfigOverridesDialogComponent } from './platform-tenant-config-overrides-dialog/platform-tenant-config-overrides-dialog.component';
import { PlatformTenantProviderComponent } from './platform-tenant-provider/platform-tenant-provider.component';
import { PlatformTenantDetailComponent } from './platform-tenant-detail/platform-tenant-detail.component';
import { PlatformTenantPurgeDialogComponent } from './platform-tenant-purge-dialog/platform-tenant-purge-dialog.component';
import { PlatformTenantFormDialogComponent } from './platform-tenant-form-dialog/platform-tenant-form-dialog.component';
import { PlatformTenantListComponent } from './platform-tenant-list/platform-tenant-list.component';
import { PlatformTenantWhatsAppConfigDialogComponent } from './platform-tenant-whatsapp-config-dialog/platform-tenant-whatsapp-config-dialog.component';
import { PlatformCreditPayersComponent } from './platform-credit-payers/platform-credit-payers.component';
import { PlatformWalletComponent } from './platform-wallet/platform-wallet.component';
import { PlatformCreditRedeemDialogComponent } from './platform-credit-payers/platform-credit-redeem-dialog.component';
import { PlatformCreditWalletDialogComponent } from './platform-credit-payers/platform-credit-wallet-dialog.component';
import { PlatformUsageComponent } from './platform-usage/platform-usage.component';
import { PlatformUserSearchComponent } from './platform-user-search/platform-user-search.component';
import { PlatformWhatsAppConnectionsComponent } from './platform-whatsapp-connections/platform-whatsapp-connections.component';
import { PlatformMediaComponent } from './platform-media/platform-media.component';
import { PlatformMessageTemplatesComponent } from './platform-message-templates/platform-message-templates.component';
import { PlatformTemplateEditDialogComponent } from './platform-template-edit-dialog/platform-template-edit-dialog.component';
import { PlatformTemplateTestDialogComponent } from './platform-template-test-dialog/platform-template-test-dialog.component';
import { PlatformWhatsAppProviderComponent } from './platform-whatsapp-provider/platform-whatsapp-provider.component';
import { PlatformWhatsAppSettingsComponent } from './platform-whatsapp-settings/platform-whatsapp-settings.component';

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
      { path: 'billing/plans/new', component: PlatformPlanEditorComponent },
      { path: 'billing/plans/:id', component: PlatformPlanEditorComponent },
      { path: 'usage', component: PlatformUsageComponent },
      // Who pays for each credit-spending scenario - the tenant or the platform - and who paid for each spend.
      { path: 'credit-payers', component: PlatformCreditPayersComponent },
      { path: 'wallet', component: PlatformWalletComponent },
      { path: 'payments', component: PlatformPaymentListComponent },
      { path: 'configuration', component: PlatformConfigurationComponent },
      // The same page, cut down to what the AI providers charge: WhatsApp message, lead discovery and AI conversation rates.
      { path: 'ai-charges', component: PlatformConfigurationComponent, data: { sections: ['whatsapp', 'lead', 'ai'] } },
      // The old usage-invoice screen was retired with prepaid billing.
      { path: 'invoices', pathMatch: 'full', redirectTo: 'payments' },
      { path: 'invoices/:id', redirectTo: 'payments' },
      { path: 'refunds', component: PlatformRefundListComponent },
      { path: 'tickets', component: PlatformTicketsComponent },
      { path: 'whatsapp-connections', component: PlatformWhatsAppConnectionsComponent },
      { path: 'jobs', component: PlatformJobsComponent },
      { path: 'aws-settings', component: PlatformAwsSettingsComponent },
      { path: 'delivery-settings', component: PlatformDeliverySettingsComponent },
      { path: 'integration-settings', component: PlatformIntegrationSettingsComponent },
      // The platform's own WhatsApp: the number, a template per notice, and the images they show.
      { path: 'whatsapp-settings', component: PlatformWhatsAppSettingsComponent },
      { path: 'whatsapp-provider', component: PlatformWhatsAppProviderComponent },
      { path: 'notice-templates', component: PlatformMessageTemplatesComponent },
      { path: 'notice-media', component: PlatformMediaComponent },
      // Razorpay test page - its own lazy module, deliberately separate from billing.
      { path: 'razorpay-test', loadChildren: () => import('../razorpay-test/razorpay-test.module').then((m) => m.RazorpayTestModule) },
      { path: 'users', component: PlatformUserSearchComponent },
      { path: 'audit-log', component: PlatformAuditLogComponent },
      { path: 'logs', component: PlatformLogsComponent },
      { path: 'knowledge', component: PlatformKnowledgeComponent },
  { path: 'studio-questionnaires', component: PlatformStudioQuestionnairesComponent },
      { path: 'announcements', component: PlatformAnnouncementListComponent },
    ],
  },
];

@NgModule({
  declarations: [
    PlatformShellComponent,
    PlatformTicketsComponent,
    PlatformDashboardComponent,
    PlatformTenantListComponent,
    PlatformTenantDetailComponent,
    PlatformTenantProviderComponent,
    PlatformTenantFormDialogComponent,
    PlatformTenantPurgeDialogComponent,
    PlatformTenantWhatsAppConfigDialogComponent,
    PlatformTenantConfigOverridesDialogComponent,
    PlatformStudioQuestionnairesComponent,
    PlatformBillingComponent,
    PlatformPlanEditorComponent,
    PlatformCreditPackFormDialogComponent,
    CountryPriceEditorComponent,
    PlatformUsageComponent,
    PlatformCreditPayersComponent,
    PlatformWalletComponent,
    PlatformCreditWalletDialogComponent,
    PlatformCreditRedeemDialogComponent,
    PlatformPaymentListComponent,
    PlatformConfigurationComponent,
    PlatformRefundListComponent,
    PlatformRefundReviewDialogComponent,
    PlatformQuotaAdjustDialogComponent,
    PlatformWhatsAppConnectionsComponent,
    PlatformJobsComponent,
    PlatformJobScheduleDialogComponent,
    PlatformAwsSettingsComponent,
    PlatformDeliverySettingsComponent,
    PlatformIntegrationSettingsComponent,
    PlatformAiPolicyComponent,
    PlatformProductSourcesComponent,
    PlatformWhatsAppSettingsComponent,
    PlatformWhatsAppProviderComponent,
    PlatformMessageTemplatesComponent,
    PlatformTemplateEditDialogComponent,
    PlatformTemplateTestDialogComponent,
    PlatformMediaComponent,
    PlatformUserSearchComponent,
    PlatformAuditLogComponent,
    PlatformLogsComponent,
    PlatformKnowledgeComponent,
    PlatformEmbeddingSettingsComponent,
    PlatformKnowledgeFormDialogComponent,
    PlatformKnowledgeDeprecateDialogComponent,
    PlatformAnnouncementListComponent,
    PlatformAnnouncementFormDialogComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class PlatformModule {}

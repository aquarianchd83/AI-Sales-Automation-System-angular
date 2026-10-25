import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { authGuard, guestGuard, homeRedirectGuard, roleGuard } from './core/guards/auth.guard';
import { featureGuard, loadEntitlementsGuard } from './core/guards/feature.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';
import { STUDIO_CONTENT_ROLES } from './core/models/content-studio.model';
import { PLATFORM_ADMIN_ROLES } from './core/models/platform.model';
import { SETTINGS_ADMIN_ROLES } from './core/models/settings.model';
import { REPORT_ROLES, TENANT_ADMIN_ROLES, TENANT_ROLES, USER_ADMIN_ROLES } from './core/models/user.model';
import { KnowledgeHubComponent } from './layout/knowledge-hub/knowledge-hub.component';
import { ShellComponent } from './layout/shell/shell.component';

const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./features/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    // Sign-in recovery: no guard at all - these pages are for people who cannot sign in. The API puts the short
    // /reset-password and /verify-email paths in its emails, so those redirect here (query parameters are kept).
    path: 'recover',
    loadChildren: () => import('./features/recovery/recovery.module').then((m) => m.RecoveryModule),
  },
  { path: 'forgot-password', redirectTo: 'recover/forgot-password', pathMatch: 'full' },
  { path: 'reset-password', redirectTo: 'recover/reset-password', pathMatch: 'full' },
  { path: 'verify-email', redirectTo: 'recover/verify-email', pathMatch: 'full' },
  {
    // What a customer reaches from the link in the SMS. No guard of any kind: the customer has no account, and the secret in the
    // link is the whole credential. Outside ShellComponent, so none of the app's chrome (menus, tenant data) is on it.
    path: 'consent/:token',
    loadChildren: () => import('./features/public-consent/public-consent.module').then((m) => m.PublicConsentModule),
  },
  {
    // No authGuard/roleGuard — a brand-new tab with no session yet. See
    // ImpersonateSessionComponent's own doc comment.
    path: 'impersonate-session',
    loadChildren: () =>
      import('./features/impersonate-session/impersonate-session.module').then(
        (m) => m.ImpersonateSessionModule
      ),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    // onboardingGuard holds a tenant in the onboarding wizard until its setup is complete.
    canActivateChild: [authGuard, onboardingGuard, loadEntitlementsGuard],
    children: [
      // Static redirectTo can't branch on the signed-in user — homeRedirectGuard sends a
      // PlatformSuperAdmin to /platform and everyone else to /dashboard. See its own doc comment.
      { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/dashboard/dashboard.module').then((m) => m.DashboardModule),
      },
      {
        path: 'customers',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/customers/customers.module').then((m) => m.CustomersModule),
      },
      {
        path: 'conversations',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/conversations/conversations.module').then((m) => m.ConversationsModule),
      },
      {
        path: 'handoffs',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/handoffs/handoffs.module').then((m) => m.HandoffsModule),
      },
      {
        path: 'leads',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/leads/leads.module').then((m) => m.LeadsModule),
      },
      {
        // Discovered leads are open to every tenant user; the module's own `profile` child route is
        // gated to tenant admins.
        path: 'lead-discovery',
        canActivate: [roleGuard, featureGuard],
        data: { roles: TENANT_ROLES, feature: 'LeadDiscovery' },
        loadChildren: () =>
          import('./features/lead-discovery/lead-discovery.module').then((m) => m.LeadDiscoveryModule),
      },
      {
        // The tenant no longer writes knowledge articles; what the AI knows comes from their sources, answers and published versions.
        // An old bookmark lands on the new home.
        path: 'knowledge-base',
        pathMatch: 'full',
        redirectTo: 'product-knowledge/sources',
      },
      {
        // "Complete Your Application Setup" - where a tenant lands until onboarding is done.
        path: 'onboarding',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/onboarding/onboarding.module').then((m) => m.OnboardingModule),
      },
      {
        path: 'packages',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/packages/packages.module').then((m) => m.PackagesModule),
      },
      {
        path: 'tags',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/tags/tags.module').then((m) => m.TagsModule),
      },
      {
        path: 'campaigns',
        canActivate: [roleGuard, featureGuard],
        data: { roles: TENANT_ROLES, feature: 'WhatsAppMessaging' },
        loadChildren: () =>
          import('./features/campaigns/campaigns.module').then((m) => m.CampaignsModule),
      },
      {
        path: 'media',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/media/media.module').then((m) => m.MediaModule),
      },
      {
        path: 'message-templates',
        canActivate: [roleGuard, featureGuard],
        data: { roles: TENANT_ROLES, feature: 'WhatsAppMessaging' },
        loadChildren: () =>
          import('./features/message-templates/message-templates.module').then(
            (m) => m.MessageTemplatesModule
          ),
      },
      {
        path: 'reports',
        canActivate: [roleGuard],
        data: { roles: REPORT_ROLES },
        loadChildren: () => import('./features/reports/reports.module').then((m) => m.ReportsModule),
      },
      {
        path: 'social-ads',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () => import('./features/social-ads/social-ads.module').then((m) => m.SocialAdsModule),
      },
      {
        // Knowledge hub: one sidenav entry, the list of knowledge screens beside whichever one is open. Pathless, so each
        // screen keeps its own URL. Product knowledge is Tenant Admin only, as on the API; the studio screens also admit Sales Managers.
        path: '',
        component: KnowledgeHubComponent,
        children: [
          {
            path: 'product-knowledge',
            canActivate: [roleGuard, featureGuard],
            data: { roles: TENANT_ADMIN_ROLES, feature: 'ProductKnowledge' },
            loadChildren: () => import('./features/product-knowledge/product-knowledge.module').then((m) => m.ProductKnowledgeModule),
          },
          {
            path: 'content-studio',
            canActivate: [roleGuard, featureGuard],
            data: { roles: STUDIO_CONTENT_ROLES, feature: 'ContentStudio' },
            loadChildren: () => import('./features/content-studio/content-studio.module').then((m) => m.ContentStudioModule),
          },
        ],
      },
      {
        path: 'audit-log',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () => import('./features/audit-log/audit-log.module').then((m) => m.AuditLogModule),
      },
      {
        path: 'agent-performance',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/agent-performance/agent-performance.module').then(
            (m) => m.AgentPerformanceModule
          ),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: USER_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/users/users.module').then((m) => m.UsersModule),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: SETTINGS_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/settings/settings.module').then((m) => m.SettingsModule),
      },
      {
        // The bell's "More notifications" screen - a tenant Admin's billing alerts, or the platform operator's job alerts.
        path: 'notifications',
        canActivate: [roleGuard],
        data: { roles: [...TENANT_ADMIN_ROLES, ...PLATFORM_ADMIN_ROLES] },
        loadChildren: () =>
          import('./features/notifications/notifications.module').then((m) => m.NotificationsModule),
      },
      {
        path: 'tenant-settings',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/tenant-settings/tenant-settings.module').then(
            (m) => m.TenantSettingsModule
          ),
      },
      {
        // Demo only: the API answers 404 unless ConsentPage:DemoOutboxEnabled is on.
        path: 'demo/sms-outbox',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () => import('./features/demo-sms-outbox/demo-sms-outbox.module').then((m) => m.DemoSmsOutboxModule),
      },
      {
        path: 'consent-page-settings',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/consent-page-settings/consent-page-settings.module').then(
            (m) => m.ConsentPageSettingsModule
          ),
      },
      {
        path: 'profile',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/business-profile/business-profile.module').then(
            (m) => m.BusinessProfileModule
          ),
      },
      {
        path: 'billing',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/billing/billing.module').then((m) => m.BillingModule),
      },
      {
        // Deliberately no role gate — every signed-in user has an account to maintain, and a
        // PlatformSuperAdmin belongs to no tenant, so this is the only profile screen they have.
        path: 'account',
        loadChildren: () =>
          import('./features/account/account.module').then((m) => m.AccountModule),
      },
      {
        // Where the account menu pointed before the profile screen existed; kept so old links and
        // bookmarks still land somewhere real.
        path: 'change-password',
        pathMatch: 'full',
        redirectTo: 'account/change-password',
      },
      {
        path: 'platform',
        canActivate: [roleGuard],
        data: { roles: PLATFORM_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/platform/platform.module').then((m) => m.PlatformModule),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}

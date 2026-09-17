import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { authGuard, guestGuard, homeRedirectGuard, roleGuard } from './core/guards/auth.guard';
import { PLATFORM_ADMIN_ROLES } from './core/models/platform.model';
import { SETTINGS_ADMIN_ROLES } from './core/models/settings.model';
import { TENANT_ADMIN_ROLES, TENANT_ROLES, USER_ADMIN_ROLES } from './core/models/user.model';
import { ShellComponent } from './layout/shell/shell.component';

const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./features/auth/auth.module').then((m) => m.AuthModule),
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
    canActivateChild: [authGuard],
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
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/lead-discovery/lead-discovery.module').then((m) => m.LeadDiscoveryModule),
      },
      {
        path: 'knowledge-base',
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/knowledge-base/knowledge-base.module').then((m) => m.KnowledgeBaseModule),
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
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
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
        canActivate: [roleGuard],
        data: { roles: TENANT_ROLES },
        loadChildren: () =>
          import('./features/message-templates/message-templates.module').then(
            (m) => m.MessageTemplatesModule
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
        path: 'tenant-settings',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/tenant-settings/tenant-settings.module').then(
            (m) => m.TenantSettingsModule
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

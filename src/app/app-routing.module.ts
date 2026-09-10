import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';
import { PLATFORM_ADMIN_ROLES } from './core/models/platform.model';
import { SETTINGS_ADMIN_ROLES } from './core/models/settings.model';
import { TENANT_ADMIN_ROLES, USER_ADMIN_ROLES } from './core/models/user.model';
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
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.module').then((m) => m.DashboardModule),
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('./features/customers/customers.module').then((m) => m.CustomersModule),
      },
      {
        path: 'conversations',
        loadChildren: () =>
          import('./features/conversations/conversations.module').then((m) => m.ConversationsModule),
      },
      {
        path: 'handoffs',
        loadChildren: () =>
          import('./features/handoffs/handoffs.module').then((m) => m.HandoffsModule),
      },
      {
        path: 'leads',
        loadChildren: () =>
          import('./features/leads/leads.module').then((m) => m.LeadsModule),
      },
      {
        path: 'knowledge-base',
        loadChildren: () =>
          import('./features/knowledge-base/knowledge-base.module').then((m) => m.KnowledgeBaseModule),
      },
      {
        path: 'tags',
        loadChildren: () =>
          import('./features/tags/tags.module').then((m) => m.TagsModule),
      },
      {
        path: 'campaigns',
        loadChildren: () =>
          import('./features/campaigns/campaigns.module').then((m) => m.CampaignsModule),
      },
      {
        path: 'media',
        loadChildren: () =>
          import('./features/media/media.module').then((m) => m.MediaModule),
      },
      {
        path: 'message-templates',
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
        path: 'billing',
        canActivate: [roleGuard],
        data: { roles: TENANT_ADMIN_ROLES },
        loadChildren: () =>
          import('./features/billing/billing.module').then((m) => m.BillingModule),
      },
      {
        path: 'change-password',
        loadChildren: () =>
          import('./features/account/account.module').then((m) => m.AccountModule),
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

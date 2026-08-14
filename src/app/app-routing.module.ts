import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';
import { USER_ADMIN_ROLES } from './core/models/user.model';
import { ShellComponent } from './layout/shell/shell.component';

const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./features/auth/auth.module').then((m) => m.AuthModule),
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
        path: 'change-password',
        loadChildren: () =>
          import('./features/account/account.module').then((m) => m.AccountModule),
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

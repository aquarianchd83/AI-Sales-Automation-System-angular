import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { SettingsListComponent } from './settings-list/settings-list.component';

/** The tenant-facing defaults, one panel each on the Tenant Settings screen. */
const TENANT_CATEGORIES = ['Campaigns', 'Media', 'Messaging', 'Ai'];

/** `categories` picks what a screen shows: only those categories, or (`exclude`) everything but them. */
const routes: Routes = [
  // The remaining (system) settings now live on the General page.
  { path: '', pathMatch: 'full', redirectTo: '/platform/configuration' },
  { path: 'system', redirectTo: '/platform/configuration' },
  { path: 'ai-providers', component: SettingsListComponent, data: { title: 'AI Providers', categories: ['AiProviders'] } },
  { path: 'tenant', component: SettingsListComponent, data: { title: 'Tenant Settings', categories: TENANT_CATEGORIES } },
  { path: 'meta-ads', component: SettingsListComponent, data: { title: 'Meta Ads', categories: ['MetaAds'] } },
];

@NgModule({
  declarations: [SettingsListComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class SettingsModule {}

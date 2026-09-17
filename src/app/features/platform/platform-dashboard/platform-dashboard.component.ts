import { Component, OnInit } from '@angular/core';

import { formatCharge } from '../../../core/models/billing.model';
import { PlatformDashboard } from '../../../core/models/platform.model';
import { PlatformDashboardService } from '../../../core/services/platform-dashboard.service';

interface Tile {
  label: string;
  icon: string;
  value: string;
  hint?: string;
}

@Component({
  selector: 'app-platform-dashboard',
  templateUrl: './platform-dashboard.component.html',
  styleUrls: ['./platform-dashboard.component.scss'],
})
export class PlatformDashboardComponent implements OnInit {
  loading = true;
  dashboard: PlatformDashboard | null = null;
  tiles: Tile[] = [];

  constructor(private readonly dashboardService: PlatformDashboardService) {}

  ngOnInit(): void {
    this.dashboardService.get().subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.tiles = this.buildTiles(dashboard);
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  private buildTiles(d: PlatformDashboard): Tile[] {
    return [
      { label: 'Active tenants', icon: 'business', value: String(d.activeTenants) },
      { label: 'Trial tenants', icon: 'hourglass_top', value: String(d.trialTenants) },
      { label: 'Suspended tenants', icon: 'block', value: String(d.suspendedTenants) },
      { label: 'Signups this month', icon: 'person_add', value: String(d.signupsThisMonth) },
      // Platform-wide figures, so they're quoted in the operator's own currency (from their profile
      // country) rather than any tenant's — see PlatformDashboard's own doc comment.
      { label: 'MRR (est.)', icon: 'payments', value: formatCharge(d.mrrLocal, d.currencySymbol) },
      { label: 'Messages this month', icon: 'forum', value: d.messagesSentThisMonth.toLocaleString() },
      {
        label: 'AI spend this month (est.)',
        icon: 'smart_toy',
        value: formatCharge(d.estimatedAiSpendThisMonthLocal, d.currencySymbol),
        hint: `${d.aiInteractionsThisMonth.toLocaleString()} AI interactions`,
      },
      {
        label: 'Webhook failures (24h)',
        icon: 'error_outline',
        value: String(d.webhookFailuresLast24h),
      },
    ];
  }
}

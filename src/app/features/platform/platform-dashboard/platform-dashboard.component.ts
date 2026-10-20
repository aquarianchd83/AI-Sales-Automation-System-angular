import { Component, OnInit } from '@angular/core';

import { PlatformDashboard } from '../../../core/models/platform.model';
import { PlatformDashboardService } from '../../../core/services/platform-dashboard.service';

type Tone = 'teal' | 'indigo' | 'amber' | 'violet' | 'rose' | 'sky';

/** A headline figure: the large cards across the top of the page. */
interface Kpi {
  label: string;
  icon: string;
  value: string;
  tone: Tone;
  hint?: string;
}

/** One slice of the tenant portfolio bar. */
interface Segment {
  label: string;
  count: number;
  percent: number;
  tone: Tone;
  icon: string;
}

/** A jump to the screen where the figure above is acted on. */
interface QuickLink {
  label: string;
  hint: string;
  icon: string;
  route: string;
}

/** Same rule as billing's formatCharge (4 decimals for sub-cent amounts) but with thousands separators, which
 * a platform-wide total needs to be readable. */
function money(amount: number, symbol = '$'): string {
  const decimals = amount === 0 || Math.abs(amount) >= 0.01 ? 2 : 4;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

@Component({
  selector: 'app-platform-dashboard',
  templateUrl: './platform-dashboard.component.html',
  styleUrls: ['./platform-dashboard.component.scss'],
})
export class PlatformDashboardComponent implements OnInit {
  loading = true;
  failed = false;
  dashboard: PlatformDashboard | null = null;
  /** When the figures on screen were fetched — rendered through zonedDate so it follows the user's timezone. */
  updatedAt: Date | null = null;

  kpis: Kpi[] = [];
  segments: Segment[] = [];
  totalTenants = 0;
  aiCostPerInteraction: string | null = null;

  readonly quickLinks: QuickLink[] = [
    { label: 'Tenants', hint: 'Browse and manage workspaces', icon: 'business', route: '/platform/tenants' },
    { label: 'Payments', hint: 'Review incoming payments', icon: 'receipt_long', route: '/platform/payments' },
    { label: 'Usage & quotas', hint: 'Message and AI consumption', icon: 'data_usage', route: '/platform/usage' },
    { label: 'WhatsApp connections', hint: 'Webhook and number health', icon: 'cloud_sync', route: '/platform/whatsapp-connections' },
  ];

  constructor(private readonly dashboardService: PlatformDashboardService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.dashboardService.get().subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.updatedAt = new Date();
        this.kpis = this.buildKpis(dashboard);
        this.buildPortfolio(dashboard);
        this.loading = false;
      },
      error: () => {
        this.failed = true;
        this.loading = false;
      },
    });
  }

  private buildKpis(d: PlatformDashboard): Kpi[] {
    return [
      // Platform-wide figures, so they're quoted in the operator's own currency (from their profile
      // country) rather than any tenant's — see PlatformDashboard's own doc comment.
      { label: 'Monthly recurring revenue', icon: 'payments', tone: 'teal', value: money(d.mrrLocal, d.currencySymbol), hint: 'Estimate' },
      { label: 'Messages this month', icon: 'forum', tone: 'indigo', value: d.messagesSentThisMonth.toLocaleString() },
      {
        label: 'AI spend this month',
        icon: 'smart_toy',
        tone: 'violet',
        value: money(d.estimatedAiSpendThisMonthLocal, d.currencySymbol),
        hint: `Estimate · ${d.aiInteractionsThisMonth.toLocaleString()} interactions`,
      },
      { label: 'Signups this month', icon: 'person_add', tone: 'sky', value: d.signupsThisMonth.toLocaleString() },
    ];
  }

  private buildPortfolio(d: PlatformDashboard): void {
    this.totalTenants = d.activeTenants + d.trialTenants + d.suspendedTenants;
    const share = (n: number) => (this.totalTenants ? (n / this.totalTenants) * 100 : 0);
    this.segments = [
      { label: 'Active', count: d.activeTenants, percent: share(d.activeTenants), tone: 'teal', icon: 'check_circle' },
      { label: 'On trial', count: d.trialTenants, percent: share(d.trialTenants), tone: 'amber', icon: 'hourglass_top' },
      { label: 'Suspended', count: d.suspendedTenants, percent: share(d.suspendedTenants), tone: 'rose', icon: 'block' },
    ];
    this.aiCostPerInteraction = d.aiInteractionsThisMonth
      ? money(d.estimatedAiSpendThisMonthLocal / d.aiInteractionsThisMonth, d.currencySymbol)
      : null;
  }
}

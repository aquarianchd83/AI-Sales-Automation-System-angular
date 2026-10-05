import { Component, OnDestroy, OnInit } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import {
  MarketingComparison,
  PackageRevenueRow,
  REVENUE_PERIODS,
  RevenueReport,
  platformLabel,
} from '../../../core/models/report.model';
import { ReportService } from '../../../core/services/report.service';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';

/** Widest a trend bar can be drawn relative to the biggest one, never below 2% so a small value stays visible. */
export function barPercent(value: number, max: number): number {
  return max > 0 && value > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
}

/** 1234.5 -> "1,234.5"; whole numbers carry no decimals, everything else at most two. */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

/** "+12.5%" / "-3%" / null — the sign is always shown so a rise and a fall can't be confused at a glance. */
export function formatChange(percent: number | null): string | null {
  if (percent === null) {
    return null;
  }
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

@Component({
  selector: 'app-revenue-report',
  templateUrl: './revenue-report.component.html',
  styleUrls: ['./revenue-report.component.scss'],
})
export class RevenueReportComponent implements OnInit, OnDestroy {
  readonly periods = REVENUE_PERIODS;
  readonly packageColumns = ['rank', 'name', 'sales', 'revenue', 'customers', 'target'];
  readonly barPercent = barPercent;
  readonly formatChange = formatChange;
  readonly platformLabel = platformLabel;

  months = 3;
  report: RevenueReport | null = null;
  loading = false;
  failed = false;
  /** The tenant's own currency symbol; empty until (or unless) the charges call answers, so amounts show bare. */
  currencySymbol = '';

  /** Biggest bar in the trend chart / biggest package, so every bar is drawn relative to it. */
  trendMax = 0;
  popularityMax = 0;

  /** Social media vs WhatsApp. Loaded alongside the report but on its own, so it failing never hides the revenue figures. */
  marketing: MarketingComparison | null = null;
  marketingFailed = false;
  spendMax = 0;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly reports: ReportService,
    private readonly tenantSettings: TenantSettingsService
  ) {}

  ngOnInit(): void {
    this.tenantSettings
      .getCharges()
      .pipe(
        map((charges) => charges.currencySymbol),
        catchError(() => of('')),
        takeUntil(this.destroy$)
      )
      .subscribe((symbol) => (this.currencySymbol = symbol));
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setPeriod(months: number): void {
    if (this.months === months) {
      return;
    }
    this.months = months;
    this.load();
  }

  load(): void {
    const months = this.months;
    this.loading = true;
    this.failed = false;
    this.reports
      .revenue(months)
      .pipe(
        map((report) => ({ report, failed: false })),
        catchError(() => of({ report: null, failed: true })),
        takeUntil(this.destroy$)
      )
      .subscribe(({ report, failed }) => {
        // A response that lands after the period has changed is dropped, so a slow 2-year answer can't
        // overwrite the 3-month view the user has since picked.
        if (months !== this.months) {
          return;
        }
        this.loading = false;
        this.failed = failed;
        this.report = report;
        this.trendMax = Math.max(0, ...(report?.trend ?? []).map((t) => t.revenue));
        this.popularityMax = Math.max(0, ...(report?.packages ?? []).map((p) => p.salesCount));
      });

    this.reports
      .marketingComparison(months)
      .pipe(
        map((comparison) => ({ comparison, failed: false })),
        catchError(() => of({ comparison: null, failed: true })),
        takeUntil(this.destroy$)
      )
      .subscribe(({ comparison, failed }) => {
        if (months !== this.months) {
          return;
        }
        this.marketingFailed = failed;
        this.marketing = comparison;
        this.spendMax = Math.max(0, ...(comparison?.spendTrend ?? []).map((t) => t.spend));
      });
  }

  /** An amount in the tenant's own currency (symbol in front), or the ad account's currency code when it differs. */
  socialMoney(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) {
      return '—';
    }
    const formatted = formatAmount(amount);
    const m = this.marketing;
    return m && !m.currencyMatches && m.spendCurrencyCode ? `${m.spendCurrencyCode} ${formatted}` : `${this.currencySymbol}${formatted}`;
  }

  money(amount: number | null | undefined): string {
    return amount === null || amount === undefined ? '—' : `${this.currencySymbol}${formatAmount(amount)}`;
  }

  /** "₹3.20 earned for every ₹1 spent" is clearer to a business owner than "ROAS 3.2x". */
  returnText(value: number | null): string | null {
    return value === null ? null : `${this.currencySymbol}${formatAmount(value)} back for every ${this.currencySymbol}1`;
  }

  get spendSourceLabel(): string {
    switch (this.marketing?.spendSource) {
      case 'Meta':
        return 'Facebook & Instagram ads (connected)';
      case 'Manual':
        return 'Monthly spend you typed in';
      default:
        return '';
    }
  }

  /** The package that sold the most — the headline of the report. */
  get topPackage(): PackageRevenueRow | null {
    return this.report?.packages.find((p) => p.rank === 1) ?? null;
  }

  /** Active packages nobody bought in the period — worth a look, or a promotion. */
  get unsoldPackages(): PackageRevenueRow[] {
    return (this.report?.packages ?? []).filter((p) => p.isActive && p.salesCount === 0);
  }

  get changeText(): string | null {
    return formatChange(this.report?.revenueChangePercent ?? null);
  }

  /** 'up' | 'down' | 'flat' — drives the arrow and colour of the change chip. */
  get changeDirection(): 'up' | 'down' | 'flat' {
    const change = this.report?.revenueChangePercent ?? 0;
    return change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  }

  get periodLabel(): string {
    return this.periods.find((p) => p.months === this.months)?.label ?? `${this.months} months`;
  }

  /** The target bar is capped at 100% of its track; the real percentage is still printed beside it. */
  get targetBar(): number {
    return Math.min(100, this.report?.targetAchievedPercent ?? 0);
  }

  /** Per-package progress towards the sales target for the period, capped like the revenue target bar. */
  targetProgress(row: PackageRevenueRow): number {
    return row.targetSales > 0 ? Math.min(100, Math.round((row.salesCount / row.targetSales) * 100)) : 0;
  }

  medalClass(rank: number): string {
    return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  }
}

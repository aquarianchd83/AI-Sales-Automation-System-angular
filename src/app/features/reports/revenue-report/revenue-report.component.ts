import { Component, OnDestroy, OnInit } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { PackageRevenueRow, REVENUE_PERIODS, RevenueReport } from '../../../core/models/report.model';
import { ReportService } from '../../../core/services/report.service';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';

/** Widest a trend bar can be drawn relative to the biggest one, never below 2% so a small value stays visible. */
export function barPercent(value: number, max: number): number {
  return max > 0 && value > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
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

  months = 3;
  report: RevenueReport | null = null;
  loading = false;
  failed = false;
  /** The tenant's own currency symbol; empty until (or unless) the charges call answers, so amounts show bare. */
  currencySymbol = '';

  /** Biggest bar in the trend chart / biggest package, so every bar is drawn relative to it. */
  trendMax = 0;
  popularityMax = 0;

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

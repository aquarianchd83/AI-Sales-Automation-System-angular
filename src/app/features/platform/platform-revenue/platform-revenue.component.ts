import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { PlatformRevenueReport, RevenueFigures } from '../../../core/models/platform.model';
import { PlatformRevenueService } from '../../../core/services/platform-revenue.service';

const KIND_LABELS: Record<string, string> = { Subscription: 'Plan subscriptions', CreditPack: 'Credit packs', Refund: 'Refunds' };

interface Tile {
  label: string;
  value: string;
  hint: string;
  /** Change against the period just before, as a percentage; null when that period had nothing to compare to. */
  change: number | null;
  /** For refunds, up is bad. */
  upIsGood: boolean;
}

interface Bar {
  label: string;
  x: number;
  w: number;
  subscriptionY: number;
  subscriptionH: number;
  packY: number;
  packH: number;
  title: string;
}

@Component({
  selector: 'app-platform-revenue',
  templateUrl: './platform-revenue.component.html',
  styleUrls: ['./platform-revenue.component.scss'],
})
export class PlatformRevenueComponent implements OnInit {
  readonly chartWidth = 720;
  readonly chartHeight = 220;
  readonly fromControl = new FormControl<Date | null>(null);
  readonly toControl = new FormControl<Date | null>(null);

  report: PlatformRevenueReport | null = null;
  loading = true;
  failed = false;
  tiles: Tile[] = [];
  bars: Bar[] = [];
  maxMonth = 0;

  constructor(private readonly revenue: PlatformRevenueService) {}

  ngOnInit(): void {
    this.load();
  }

  apply(): void {
    this.load(this.fromControl.value, this.toControl.value);
  }

  clear(): void {
    this.fromControl.setValue(null);
    this.toControl.setValue(null);
    this.load();
  }

  kindLabel(kind: string): string {
    return KIND_LABELS[kind] ?? kind;
  }

  /** Rupees, Indian digit grouping, no decimals from a thousand up. */
  inr(value: number): string {
    const big = Math.abs(value) >= 1000;
    const digits = big ? 0 : 2;
    return '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }

  changeText(tile: Tile): string {
    if (tile.change === null) return 'no earlier period to compare';
    const sign = tile.change > 0 ? '+' : '';
    return `${sign}${tile.change.toFixed(1)}% vs the period before`;
  }

  changeGood(tile: Tile): boolean {
    return tile.change === null || tile.change === 0 || tile.change > 0 === tile.upIsGood;
  }

  get hasData(): boolean {
    return !!this.report && (this.report.totals.payments > 0 || this.report.totals.refundCount > 0);
  }

  private load(from?: Date | null, to?: Date | null): void {
    this.loading = true;
    this.failed = false;
    this.revenue
      .get(from ? this.day(from) : undefined, to ? this.day(to) : undefined)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (report) => {
          this.report = report;
          this.tiles = this.buildTiles(report);
          this.buildChart(report);
        },
        error: () => (this.failed = true),
      });
  }

  /** The date picker's local calendar day as yyyy-MM-dd - toISOString would shift it a day in zones ahead of UTC. */
  private day(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private buildTiles(r: PlatformRevenueReport): Tile[] {
    const tile = (label: string, pick: (f: RevenueFigures) => number, hint: string, upIsGood = true): Tile => {
      const now = pick(r.totals);
      const before = pick(r.previous);
      return { label, value: this.inr(now), hint, change: before ? ((now - before) / Math.abs(before)) * 100 : null, upIsGood };
    };
    return [
      tile('Net revenue', (f) => f.net, 'Paid by tenants, less refunds, tax included'),
      tile('Revenue ex-tax', (f) => f.netExTax, 'What the platform keeps after tax'),
      tile('Gross payments', (f) => f.gross, `${r.totals.payments} payment${r.totals.payments === 1 ? '' : 's'}`),
      tile('Refunds', (f) => f.refunds, `${r.totals.refundCount} refund${r.totals.refundCount === 1 ? '' : 's'}`, false),
      tile('Tax collected', (f) => f.tax, 'Inside the net figure; owed onward'),
    ];
  }

  private buildChart(r: PlatformRevenueReport): void {
    const months = r.months;
    this.maxMonth = Math.max(0, ...months.map((m) => m.subscription + m.creditPack));
    if (!months.length || !this.maxMonth) {
      this.bars = [];
      return;
    }
    const slot = this.chartWidth / months.length;
    const w = Math.min(48, slot * 0.6);
    const scale = (value: number) => (value / this.maxMonth) * (this.chartHeight - 8);
    this.bars = months.map((m, i) => {
      const subscriptionH = scale(m.subscription);
      const packH = scale(m.creditPack);
      return {
        label: m.month,
        x: i * slot + (slot - w) / 2,
        w,
        subscriptionH,
        subscriptionY: this.chartHeight - subscriptionH,
        packH,
        packY: this.chartHeight - subscriptionH - packH,
        title: `${m.month}: subscriptions ${this.inr(m.subscription)}, credit packs ${this.inr(m.creditPack)}, refunds ${this.inr(m.refunds)}, net ${this.inr(m.net)}`,
      };
    });
  }
}

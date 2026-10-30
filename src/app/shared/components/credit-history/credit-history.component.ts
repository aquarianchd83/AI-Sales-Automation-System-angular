import { Component, Input, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  QUOTA_ENTRY_ACTION_LABELS,
  QuotaEntryType,
  QuotaLedgerEntry,
  QuotaLedgerQuery,
  QuotaLedgerSummary,
  formatUnits,
} from '../../../core/models/billing.model';
import { PagedResult } from '../../../core/models/paged-result.model';
import { PLATFORM_FEATURES, PLATFORM_FEATURE_LABELS, PlatformFeature } from '../../../core/models/wallet.model';

export type CreditHistoryFilter = PlatformFeature | 'Purchased' | 'Used' | '';

/** What a screen supplies so the same history can show one tenant's credits to a platform admin or the tenant its own. */
export type CreditHistoryLedgerSource = (query: QuotaLedgerQuery) => Observable<PagedResult<QuotaLedgerEntry>>;
export type CreditHistorySummarySource = (
  days: number,
  filter: { feature?: string; entryType?: number; from?: string; to?: string }
) => Observable<QuotaLedgerSummary>;

/**
 * A wallet's credit history: a stat tile for every value it can be narrowed to, a graph of the last 30 days (or the chosen dates),
 * and the entries behind them. Clicking a tile narrows the entries and the graph; the From / To dates and the Filter button narrow
 * everything by day. The tiles always add up the whole range, so clicking from one to another does not change them.
 */
@Component({
  selector: 'app-credit-history',
  templateUrl: './credit-history.component.html',
  styleUrls: ['./credit-history.component.scss'],
})
export class CreditHistoryComponent implements OnInit {
  @Input() fetchLedger!: CreditHistoryLedgerSource;
  @Input() fetchSummary!: CreditHistorySummarySource;
  @Input() heading = 'Credit history';

  readonly formatUnits = formatUnits;
  readonly featureLabels = PLATFORM_FEATURE_LABELS;
  readonly ledgerColumns = ['processingDate', 'credits', 'unit', 'activity', 'balance'];
  readonly pageSize = 10;
  readonly chartWidth = 640;
  readonly chartHeight = 150;

  readonly fromControl = new FormControl<Date | null>(null);
  readonly toControl = new FormControl<Date | null>(null);

  filter: CreditHistoryFilter = '';
  /** The range the entries, tiles and graph are showing ("from|to"); the pickers only change it when Filter is pressed. */
  appliedRange = '|';

  summary: QuotaLedgerSummary | null = null;
  chartDaily: QuotaLedgerSummary['daily'] = [];
  ledger: QuotaLedgerEntry[] = [];
  ledgerTotal = 0;
  page = 1;
  loadingSummary = true;
  loadingChart = false;
  loadingLedger = true;
  showEntries = false;

  ngOnInit(): void {
    this.reload();
  }

  /** True once the pickers hold something other than what is applied, so Filter has something to do. */
  get rangeChanged(): boolean {
    const { from, to } = this.pickedRange();
    return (from ?? '') + '|' + (to ?? '') !== this.appliedRange;
  }

  get hasRange(): boolean {
    return !!(this.fromControl.value || this.toControl.value);
  }

  /** What period the graph covers, in words. */
  get chartPeriod(): string {
    const [from, to] = this.appliedRange.split('|');
    return !from && !to ? 'Last 30 days' : (from || 'the start') + ' to ' + (to || 'today');
  }

  /** What the graph is showing, in words: "All activity", "Purchased", "Lead discovery"... */
  get chartTitle(): string {
    if (this.filter === '') {
      return 'All activity';
    }
    return this.filter === 'Purchased' || this.filter === 'Used' ? this.filter : this.featureLabels[this.filter];
  }

  /** One tile per value the history can be narrowed to: what it adds up to over the range. */
  get tiles(): { key: CreditHistoryFilter; label: string; value: string; detail: string }[] {
    const s = this.summary;
    if (!s) {
      return [];
    }
    const type = (t: QuotaEntryType) => s.byEntryType.find((e) => e.entryType === t);
    const used = -((type(QuotaEntryType.Consumption)?.units ?? 0) + (type(QuotaEntryType.ConsumptionReversal)?.units ?? 0));
    const purchased = type(QuotaEntryType.Purchase);
    const entries = (n: number) => (n === 1 ? '1 entry' : n + ' entries');
    return [
      { key: '', label: 'All activity', value: String(s.totalEntries), detail: s.totalEntries === 1 ? 'movement' : 'movements' },
      { key: 'Purchased', label: 'Purchased', value: formatUnits(purchased?.units ?? 0), detail: entries(purchased?.count ?? 0) },
      { key: 'Used', label: 'Used', value: formatUnits(used), detail: entries(type(QuotaEntryType.Consumption)?.count ?? 0) },
      ...PLATFORM_FEATURES.map((f) => {
        const row = s.byFeature.find((x) => x.feature === f);
        return { key: f as CreditHistoryFilter, label: this.featureLabels[f], value: formatUnits(row?.unitsUsed ?? 0), detail: entries(row?.count ?? 0) };
      }),
    ];
  }

  /** The daily series as SVG bars: credits bought (green) and used (red) per day, scaled to the busiest day. */
  get chartBars(): { x: number; y: number; w: number; h: number; kind: 'in' | 'out'; tip: string }[] {
    const days = this.chartDaily;
    const max = Math.max(1, ...days.flatMap((d) => [d.purchased, d.used]));
    const slot = this.chartWidth / Math.max(1, days.length);
    const w = Math.max(2, slot / 2 - 1);
    const bars: { x: number; y: number; w: number; h: number; kind: 'in' | 'out'; tip: string }[] = [];
    days.forEach((d, i) => {
      const add = (value: number, kind: 'in' | 'out', offset: number, label: string) => {
        if (value <= 0) {
          return;
        }
        const h = Math.max(1, (value / max) * (this.chartHeight - 4));
        bars.push({ x: i * slot + offset, y: this.chartHeight - h, w, h, kind, tip: d.date + ': ' + formatUnits(value) + ' ' + label });
      };
      add(d.purchased, 'in', 0, 'purchased');
      add(d.used, 'out', w + 1, 'used');
    });
    return bars;
  }

  get chartPeak(): number {
    return Math.max(0, ...this.chartDaily.flatMap((d) => [d.purchased, d.used]));
  }

  get chartHasData(): boolean {
    return this.chartPeak > 0;
  }

  /** What happened to the credits, in a word: Purchased, Used, Plan credit, Expired, Refunded... */
  action(entry: QuotaLedgerEntry): string {
    return QUOTA_ENTRY_ACTION_LABELS[entry.entryType];
  }

  /** Units that came in read green, units that went out read red, and a hold or release (which nets out) stays neutral. */
  tone(entry: QuotaLedgerEntry): 'in' | 'out' | 'neutral' {
    if (entry.entryType === QuotaEntryType.RefundHold || entry.entryType === QuotaEntryType.RefundRelease) {
      return 'neutral';
    }
    return entry.unitsDelta >= 0 ? 'in' : 'out';
  }

  /** The feature the entry was for and its note, or a dash. */
  activity(entry: QuotaLedgerEntry): string {
    const parts: string[] = [];
    if (entry.feature) {
      parts.push(this.featureLabels[entry.feature]);
    }
    if (entry.note) {
      parts.push(entry.note);
    }
    return parts.length ? parts.join(' · ') : '—';
  }

  onFilter(filter: CreditHistoryFilter): void {
    this.filter = filter;
    this.page = 1;
    this.loadLedger();
    this.loadChart();
  }

  /** Applies the picked dates to the entries, the tiles and the graph. */
  applyRange(): void {
    const { from, to } = this.pickedRange();
    this.appliedRange = (from ?? '') + '|' + (to ?? '');
    this.page = 1;
    this.loadLedger();
    this.loadSummary();
  }

  clearRange(): void {
    this.fromControl.setValue(null);
    this.toControl.setValue(null);
    this.appliedRange = '|';
    this.page = 1;
    this.loadLedger();
    this.loadSummary();
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.loadLedger();
  }

  private reload(): void {
    this.loadLedger();
    this.loadSummary();
  }

  /** The picked calendar days as yyyy-MM-dd (not shifted by the time zone). */
  private pickedRange(): { from?: string; to?: string } {
    const day = (d: Date | null) =>
      d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : undefined;
    return { from: day(this.fromControl.value), to: day(this.toControl.value) };
  }

  private appliedFilter(): { from?: string; to?: string } {
    const [from, to] = this.appliedRange.split('|');
    return { from: from || undefined, to: to || undefined };
  }

  private kind(): { feature?: PlatformFeature; entryType?: QuotaEntryType } {
    const f = this.filter;
    return {
      feature: f && f !== 'Purchased' && f !== 'Used' ? f : undefined,
      entryType: f === 'Purchased' ? QuotaEntryType.Purchase : f === 'Used' ? QuotaEntryType.Consumption : undefined,
    };
  }

  private loadLedger(): void {
    this.loadingLedger = true;
    this.fetchLedger({ page: this.page, pageSize: this.pageSize, ...this.kind(), ...this.appliedFilter() })
      .pipe(finalize(() => (this.loadingLedger = false)))
      .subscribe({
        next: (result) => {
          this.ledger = result.items;
          this.ledgerTotal = result.totalCount;
        },
      });
  }

  private loadChart(): void {
    this.loadingChart = true;
    this.fetchSummary(30, { ...this.kind(), ...this.appliedFilter() })
      .pipe(finalize(() => (this.loadingChart = false)))
      .subscribe({ next: (result) => (this.chartDaily = result.daily) });
  }

  /** The tiles total the whole range whatever tile is selected; the graph follows the selection. */
  private loadSummary(): void {
    this.loadingSummary = true;
    this.fetchSummary(30, this.appliedFilter())
      .pipe(finalize(() => (this.loadingSummary = false)))
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          if (this.filter) {
            this.loadChart();
          } else {
            this.chartDaily = summary.daily;
          }
        },
      });
  }
}

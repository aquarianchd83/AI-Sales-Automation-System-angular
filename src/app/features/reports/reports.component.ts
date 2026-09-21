import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { catchError, map, takeUntil } from 'rxjs/operators';

import {
  AiPerformanceReport,
  CampaignPerformanceReport,
  HumanAgentPerformanceReport,
  LeadFunnelReport,
  REPORT_WINDOWS,
} from '../../core/models/report.model';
import { ReportService } from '../../core/services/report.service';

type ReportTab = 'campaigns' | 'funnel' | 'agents' | 'ai';

/** Tab order, matching the mat-tab-group in the template. */
const TABS: ReportTab[] = ['campaigns', 'funnel', 'agents', 'ai'];

/** A report tab's own load state: each tab loads on first view and again when the window changes. */
interface Panel<T> {
  data: T | null;
  loading: boolean;
  failed: boolean;
}

function emptyPanel<T>(): Panel<T> {
  return { data: null, loading: false, failed: false };
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
})
export class ReportsComponent implements OnInit, OnDestroy {
  readonly windows = REPORT_WINDOWS;
  readonly campaignColumns = ['name', 'audience', 'sent', 'delivered', 'read', 'responded', 'optedOut', 'handedOff'];
  readonly agentColumns = ['name', 'leads', 'won', 'winRate', 'handoffs', 'resolved', 'open', 'resolution'];
  readonly modelColumns = ['model', 'interactions', 'confidence', 'latency'];

  days = 30;
  tabIndex = 0;

  campaigns: Panel<CampaignPerformanceReport> = emptyPanel();
  funnel: Panel<LeadFunnelReport> = emptyPanel();
  agents: Panel<HumanAgentPerformanceReport> = emptyPanel();
  ai: Panel<AiPerformanceReport> = emptyPanel();

  /** Largest stage count, so the funnel bars are drawn relative to it rather than to the total. */
  funnelMax = 0;
  /** Largest daily count for the AI volume bars. */
  dailyMax = 0;

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly reports: ReportService) {}

  ngOnInit(): void {
    this.run('campaigns');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setWindow(days: number): void {
    if (this.days === days) {
      return;
    }
    this.days = days;
    this.campaigns = emptyPanel();
    this.funnel = emptyPanel();
    this.agents = emptyPanel();
    this.ai = emptyPanel();
    this.run(TABS[this.tabIndex]);
  }

  onTab(index: number): void {
    this.tabIndex = index;
    const tab = TABS[index];
    const panel = this.panelFor(tab);
    if (!panel.data && !panel.loading) {
      this.run(tab);
    }
  }

  retry(tab: ReportTab): void {
    this.run(tab);
  }

  private panelFor(tab: ReportTab): Panel<unknown> {
    switch (tab) {
      case 'campaigns':
        return this.campaigns;
      case 'funnel':
        return this.funnel;
      case 'agents':
        return this.agents;
      default:
        return this.ai;
    }
  }

  private run(tab: ReportTab): void {
    const days = this.days;
    switch (tab) {
      case 'campaigns':
        this.campaigns = this.load(this.campaigns, this.reports.campaignPerformance(days), days, (p) => (this.campaigns = p));
        break;
      case 'funnel':
        this.funnel = this.load(this.funnel, this.reports.leadFunnel(days), days, (p) => {
          this.funnel = p;
          this.funnelMax = Math.max(0, ...(p.data?.stages ?? []).map((s) => s.count));
        });
        break;
      case 'agents':
        this.agents = this.load(this.agents, this.reports.agentPerformance(days), days, (p) => (this.agents = p));
        break;
      case 'ai':
        this.ai = this.load(this.ai, this.reports.aiPerformance(days), days, (p) => {
          this.ai = p;
          this.dailyMax = Math.max(0, ...(p.data?.daily ?? []).map((d) => d.interactions));
        });
        break;
    }
  }

  /** Marks the panel loading and returns it; `apply` receives the settled panel. A response that lands after
   * the window has changed is dropped, so an old 7-day report can never overwrite a fresh 90-day one. */
  private load<T>(current: Panel<T>, source: Observable<T>, days: number, apply: (panel: Panel<T>) => void): Panel<T> {
    source
      .pipe(
        map((data): Panel<T> => ({ data, loading: false, failed: false })),
        catchError(() => of<Panel<T>>({ data: null, loading: false, failed: true })),
        takeUntil(this.destroy$)
      )
      .subscribe((panel) => {
        if (days === this.days) {
          apply(panel);
        }
      });
    return { ...current, loading: true, failed: false };
  }

  barWidth(value: number, max: number): number {
    return max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  }
}

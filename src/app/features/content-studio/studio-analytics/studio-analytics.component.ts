import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { AnalyticsSummary, MetricPoint, PublicationPerformance } from '../../../core/models/content-planner.model';
import { ContentPlannerService } from '../../../core/services/content-planner.service';
import { NotificationService } from '../../../core/services/notification.service';

export const SPARK_WIDTH = 120;
export const SPARK_HEIGHT = 32;

/**
 * How the videos published from the studio are doing: views, likes and comments, read from the platform once a day (and on request, about every
 * 15 minutes per video). Each video keeps its history, drawn as a small line. A video the platform no longer returns keeps its last numbers and
 * says so. The last 30 days are shown as the path a video takes: scripts written, approved, made into videos, published.
 */
@Component({
  selector: 'app-studio-analytics',
  templateUrl: './studio-analytics.component.html',
  styleUrls: ['./studio-analytics.component.scss'],
})
export class StudioAnalyticsComponent implements OnInit {
  summary: AnalyticsSummary | null = null;
  loading = true;
  loadFailed = false;
  refreshing: Record<string, boolean> = {};

  constructor(
    private readonly planner: ContentPlannerService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.planner
      .analytics()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (s) => (this.summary = s), error: () => (this.loadFailed = true) });
  }

  refresh(item: PublicationPerformance): void {
    if (this.refreshing[item.id]) {
      return;
    }
    this.refreshing = { ...this.refreshing, [item.id]: true };
    this.planner
      .refreshMetrics(item.id)
      .pipe(finalize(() => (this.refreshing = { ...this.refreshing, [item.id]: false })))
      .subscribe({
        next: (fresh) => {
          if (this.summary) {
            const items = this.summary.items.map((i) => (i.id === fresh.id ? fresh : i));
            this.summary = { ...this.summary, items, views: sum(items, 'views'), likes: sum(items, 'likes'), comments: sum(items, 'comments') };
          }
          this.notify.success('Numbers updated.');
        },
        // ErrorInterceptor shows why (updated a few minutes ago, the account needs connecting again).
        error: () => undefined,
      });
  }

  /** The points of a small line chart of a video's views over time, or null when there is not yet a line to draw. */
  spark(series: MetricPoint[]): string | null {
    if (series.length < 2) {
      return null;
    }
    const times = series.map((p) => new Date(p.at).getTime());
    const min = Math.min(...series.map((p) => p.views));
    const max = Math.max(...series.map((p) => p.views));
    const t0 = times[0];
    const span = Math.max(1, times[times.length - 1] - t0);
    return series
      .map((p, i) => {
        const x = ((times[i] - t0) / span) * (SPARK_WIDTH - 4) + 2;
        const y = max === min ? SPARK_HEIGHT / 2 : SPARK_HEIGHT - 3 - ((p.views - min) / (max - min)) * (SPARK_HEIGHT - 6);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  readonly sparkWidth = SPARK_WIDTH;
  readonly sparkHeight = SPARK_HEIGHT;

  get funnelSteps(): { label: string; value: number }[] {
    const f = this.summary?.last30Days;
    return f
      ? [
          { label: 'Scripts written', value: f.scriptsWritten },
          { label: 'Approved', value: f.scriptsApproved },
          { label: 'Videos made', value: f.videosMade },
          { label: 'Published', value: f.videosPublished },
        ]
      : [];
  }
}

function sum(items: PublicationPerformance[], key: 'views' | 'likes' | 'comments'): number {
  return items.reduce((total, i) => total + i[key], 0);
}

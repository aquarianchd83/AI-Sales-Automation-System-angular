import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { AnalyticsSummary, MetricPoint, PublicationPerformance } from '../../../core/models/content-planner.model';
import { ContentPlannerService } from '../../../core/services/content-planner.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { SPARK_HEIGHT, SPARK_WIDTH, StudioAnalyticsComponent } from './studio-analytics.component';

const point = (day: number, views: number): MetricPoint => ({ at: `2026-10-${String(day).padStart(2, '0')}T05:15:00Z`, views, likes: 0, comments: 0 });

const item = (over: Partial<PublicationPerformance> = {}): PublicationPerformance => ({
  id: 'p1', versionId: 'v1', title: 'Cataract surgery explained', accountName: 'Clinic Channel', privacy: 'private', url: 'https://www.youtube.com/watch?v=abc', publishedAtUtc: '2026-10-20T10:00:00Z',
  views: 150, likes: 12, comments: 2, refreshedAtUtc: '2026-10-27T05:15:00Z', missingOnPlatform: false, series: [point(25, 100), point(26, 120), point(27, 150)], ...over,
});

const summary = (over: Partial<AnalyticsSummary> = {}): AnalyticsSummary => ({
  published: 2, waitingOrSending: 0, failedLast30Days: 0, views: 157, likes: 13, comments: 2, lastUpdatedUtc: '2026-10-27T05:15:00Z',
  last30Days: { scriptsWritten: 6, scriptsApproved: 3, videosMade: 2, videosPublished: 2 }, items: [item(), item({ id: 'p2', title: 'Second', views: 7, likes: 1, comments: 0, series: [point(27, 7)] })], ...over,
});

describe('StudioAnalyticsComponent', () => {
  let fixture: ComponentFixture<StudioAnalyticsComponent>;
  let api: jasmine.SpyObj<ContentPlannerService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (sel: string) => (root().querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const present = (testId: string) => root().querySelector(`[data-testid="${testId}"]`) !== null;

  function render(data: AnalyticsSummary): StudioAnalyticsComponent {
    api = jasmine.createSpyObj('ContentPlannerService', ['analytics', 'refreshMetrics']);
    api.analytics.and.returnValue(of(data));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      declarations: [StudioAnalyticsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ContentPlannerService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(StudioAnalyticsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => fixture?.destroy());

  it('shows the totals, when they were last read and the path of the last 30 days', () => {
    render(summary());

    expect(text('[data-testid="published"]')).toBe('2');
    expect(text('[data-testid="views"]')).toBe('157');
    expect(text('[data-testid="likes"]')).toBe('13');
    expect(text('[data-testid="comments"]')).toBe('2');
    expect(text('[data-testid="updated"]')).toContain('Last updated');
    expect(text('[data-testid="funnel"]')).toBe('6Scripts written3Approved2Videos made2Published');
  });

  it('lists each video with its numbers and a line of its views once there are two readings', () => {
    render(summary());

    expect(text('[data-item="p1"] [data-testid="item-views"]')).toBe('150');
    expect(root().querySelector('[data-item="p1"] [data-testid="spark"]')).not.toBeNull();
    expect(root().querySelector('[data-item="p2"] [data-testid="spark"]')).toBeNull();
    expect(text('[data-item="p2"] [data-testid="no-line"]')).toContain('after the second reading');
    expect(root().querySelector<HTMLAnchorElement>('[data-item="p1"] [data-testid="open"]')!.href).toBe('https://www.youtube.com/watch?v=abc');
  });

  it('draws the line from the earliest reading on the left to the latest on the right, higher for more views', () => {
    const c = render(summary());

    const points = c.spark([point(25, 100), point(26, 120), point(27, 150)])!.split(' ').map((p) => p.split(',').map(Number));

    expect(points[0][0]).toBeCloseTo(2, 1);
    expect(points[2][0]).toBeCloseTo(SPARK_WIDTH - 2, 1);
    expect(points[0][1]).toBeGreaterThan(points[1][1]); // fewer views is lower on the screen (larger y)
    expect(points[1][1]).toBeGreaterThan(points[2][1]);
    expect(points[2][1]).toBeGreaterThanOrEqual(3);
    expect(points[0][1]).toBeLessThanOrEqual(SPARK_HEIGHT - 3);
    expect(c.spark([point(27, 5)])).toBeNull();
    expect(c.spark([])).toBeNull();
    expect(c.spark([point(26, 9), point(27, 9)])!.split(' ').every((p) => Number(p.split(',')[1]) === SPARK_HEIGHT / 2)).toBeTrue(); // flat stays level
  });

  it('says a video is gone from YouTube and that one has not been read yet', () => {
    render(summary({ items: [item({ missingOnPlatform: true }), item({ id: 'p2', refreshedAtUtc: null, series: [] })] }));

    expect(text('[data-item="p1"] [data-testid="missing"]')).toContain('no longer shows this video');
    expect(text('[data-item="p2"] [data-testid="not-yet"]')).toContain('first numbers arrive within a day');
    expect(root().querySelector('[data-item="p1"] [data-testid="not-yet"]')).toBeNull();
  });

  it('points to the planner when nothing is published, and mentions what is waiting or failed', () => {
    render(summary({ published: 0, items: [], waitingOrSending: 1, failedLast30Days: 2, views: 0, likes: 0, comments: 0, lastUpdatedUtc: null }));

    expect(text('[data-testid="none"]')).toContain('Nothing is published yet');
    expect(text('[data-testid="queue"]')).toContain('1 waiting or being sent.');
    expect(text('[data-testid="queue"]')).toContain('2 failed in the last 30 days');
    expect(present('updated')).toBeFalse();
  });

  it('updates one video on request, replaces its numbers and adds the totals up again', () => {
    const c = render(summary());
    api.refreshMetrics.and.returnValue(of(item({ views: 400, likes: 20, comments: 5, series: [point(25, 100), point(27, 400)] })));

    root().querySelector<HTMLElement>('[data-item="p1"] [data-testid="refresh"]')!.click();
    fixture.detectChanges();

    expect(api.refreshMetrics).toHaveBeenCalledWith('p1');
    expect(text('[data-item="p1"] [data-testid="item-views"]')).toBe('400');
    expect(c.summary!.views).toBe(407); // 400 + the other video's 7
    expect(c.summary!.likes).toBe(21);
    expect(notify.success).toHaveBeenCalledWith('Numbers updated.');
    expect(c.refreshing['p1']).toBeFalse();
  });

  it('keeps the old numbers when the update is refused', () => {
    const c = render(summary());
    api.refreshMetrics.and.returnValue(throwError(() => new Error('updated 5 minutes ago')));

    c.refresh(c.summary!.items[0]);

    expect(c.summary!.views).toBe(157);
    expect(c.refreshing['p1']).toBeFalse();
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('offers to try again when the numbers cannot be loaded', () => {
    api = jasmine.createSpyObj('ContentPlannerService', ['analytics', 'refreshMetrics']);
    api.analytics.and.returnValues(throwError(() => new Error('down')), of(summary()));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      declarations: [StudioAnalyticsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: ContentPlannerService, useValue: api }, { provide: NotificationService, useValue: notify }],
    });
    fixture = TestBed.createComponent(StudioAnalyticsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.loadFailed).toBeTrue();

    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(fixture.componentInstance.loadFailed).toBeFalse();
    expect(text('[data-testid="published"]')).toBe('2');
  });
});

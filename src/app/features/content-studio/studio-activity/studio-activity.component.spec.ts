import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { QuotaType } from '../../../core/models/billing.model';
import {
  StudioActivity,
  StudioActivityKind,
  StudioActivityStatus,
  StudioApprovalPolicy,
  StudioOverview,
} from '../../../core/models/content-studio.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { StudioActivityComponent } from './studio-activity.component';

const row = (id: string, over: Partial<StudioActivity> = {}): StudioActivity => ({
  id,
  kind: StudioActivityKind.Script,
  kindLabel: 'Script',
  status: StudioActivityStatus.Completed,
  description: `Script for topic ${id}`,
  quotaType: QuotaType.ContentGenerations,
  units: 1,
  unitsRefunded: 0,
  netUnits: 1,
  balanceAfter: 9,
  operationKey: `studio:gen-${id}`,
  referenceType: 'ContentProject',
  referenceId: 'p1',
  provider: 'OpenAI',
  detail: null,
  actorUserId: null,
  actorName: 'Asha Admin',
  requestedAtUtc: '2026-10-10T08:00:00Z',
  completedAtUtc: '2026-10-10T08:00:05Z',
  ...over,
});

const overview = (over: Partial<StudioOverview> = {}): StudioOverview => ({
  enabled: true,
  approvalPolicy: StudioApprovalPolicy.AdminOnly,
  balances: [
    { quotaType: QuotaType.ContentGenerations, balance: 8, capacity: 10, grants: [] },
    { quotaType: QuotaType.VideoRenders, balance: 0, capacity: 3, grants: [] },
  ],
  last30Days: [
    { quotaType: QuotaType.ContentGenerations, charged: 3, refunded: 1, net: 2, activities: 4, blocked: 1 },
    { quotaType: QuotaType.VideoRenders, charged: 3, refunded: 0, net: 3, activities: 3, blocked: 0 },
  ],
  ...over,
});

describe('StudioActivityComponent', () => {
  let fixture: ComponentFixture<StudioActivityComponent>;
  let getActivity: jasmine.Spy;
  let updateSettings: jasmine.Spy;

  function render(options: { overview?: StudioOverview; rows?: StudioActivity[] } = {}): HTMLElement {
    const rows = options.rows ?? [];
    getActivity = jasmine
      .createSpy('getActivity')
      .and.returnValue(of({ ...emptyPage<StudioActivity>(), items: rows, totalCount: rows.length, totalPages: 1 }));

    updateSettings = jasmine.createSpy('updateSettings').and.callFake((s) => of(s));

    TestBed.configureTestingModule({
      declarations: [StudioActivityComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ContentStudioService, useValue: { getOverview: () => of(options.overview ?? overview()), getActivity, updateSettings } },
        { provide: NotificationService, useValue: { success: jasmine.createSpy('success') } },
      ],
    });
    fixture = TestBed.createComponent(StudioActivityComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows a balance card for each studio quota with its last-30-day totals', () => {
    const cards = Array.from(render().querySelectorAll('.balance-card'));

    expect(cards.length).toBe(2);
    expect(text(cards[0])).toContain('Content generations');
    expect(text(cards[0])).toContain('8');
    expect(text(cards[0])).toContain('of 10 available');
    expect(text(cards[0])).toContain('2 used');
    expect(text(cards[0])).toContain('Refused');
    expect(cards[1].classList).toContain('balance-card--empty');
    expect(text(cards[1])).toContain('Used up');
  });

  it('lists each activity with what it cost and how it ended', () => {
    const el = render({
      rows: [
        row('a'),
        row('b', { status: StudioActivityStatus.Refunded, unitsRefunded: 1, netUnits: 0, detail: 'Render provider failed' }),
        row('c', { status: StudioActivityStatus.Blocked, units: 0, netUnits: 0 }),
        row('d', { kind: StudioActivityKind.StockAssetSearch, kindLabel: 'Stock image search', units: 0, netUnits: 0 }),
      ],
    });

    const rows = Array.from(el.querySelectorAll('tr.activity-row'));
    expect(rows.length).toBe(4);
    expect(text(rows[0])).toContain('−1');
    expect(text(rows[0])).toContain('Done');
    expect(text(rows[1])).toContain('0 (1 refunded)');
    expect(text(rows[1])).toContain('Refunded');
    expect(text(rows[2])).toContain('Not charged');
    expect(text(rows[2])).toContain('Not run (no credits)');
    expect(text(rows[3])).toContain('Free');
  });

  it('opens the full detail of a row beside the list, without leaving the page', () => {
    const el = render({ rows: [row('a', { detail: 'Because' }), row('b')] });
    expect(el.querySelector('.detail-card')).toBeNull();

    (el.querySelectorAll('tr.activity-row')[0] as HTMLElement).click();
    fixture.detectChanges();

    const panel = el.querySelector('.detail-card');
    expect(panel).not.toBeNull();
    expect(text(panel)).toContain('Script for topic a');
    expect(text(panel)).toContain('Asha Admin');
    expect(text(panel)).toContain('OpenAI');
    expect(text(panel)).toContain('studio:gen-a');
    expect(text(panel)).toContain('Because');
    expect(el.querySelector('.split')?.classList).toContain('split--detail');

    (el.querySelectorAll('tr.activity-row')[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.detail-card')).toBeNull();
  });

  it('asks the API for the chosen filters and starts again from page one', () => {
    render({ rows: [row('a')] });
    getActivity.calls.reset();

    const component = fixture.componentInstance;
    component.kindFilter = StudioActivityKind.VideoRender;
    component.statusFilter = StudioActivityStatus.Blocked;
    component.quotaFilter = QuotaType.VideoRenders;
    component.period = component.periods[3];
    component.onFilterChange();

    const query = getActivity.calls.mostRecent().args[0];
    expect(query.page).toBe(1);
    expect(query.kind).toBe(StudioActivityKind.VideoRender);
    expect(query.status).toBe(StudioActivityStatus.Blocked);
    expect(query.quotaType).toBe(QuotaType.VideoRenders);
    expect(query.fromUtc).toBeNull();
  });

  it('searches after a short pause rather than on every keystroke', fakeAsync(() => {
    render({ rows: [row('a')] });
    getActivity.calls.reset();

    fixture.componentInstance.search.setValue('scr');
    fixture.componentInstance.search.setValue('script');
    tick(100);
    expect(getActivity).not.toHaveBeenCalled();
    tick(300);

    expect(getActivity).toHaveBeenCalledTimes(1);
    expect(getActivity.calls.mostRecent().args[0].search).toBe('script');
  }));

  it('defaults to the last 30 days', () => {
    render();

    const from = getActivity.calls.mostRecent().args[0].fromUtc as string;
    const days = (Date.now() - new Date(from).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it('explains an empty list, and an empty filtered list differently', () => {
    const el = render();
    expect(text(el.querySelector('.empty-state'))).toContain('No studio activity yet');

    fixture.componentInstance.kindFilter = StudioActivityKind.Script;
    fixture.componentInstance.onFilterChange();
    fixture.detectChanges();
    expect(text(el.querySelector('.empty-state'))).toContain('Nothing matches these filters');
  });

  it('tells the tenant when the platform has not switched the studio on', () => {
    const el = render({ overview: overview({ enabled: false }) });

    expect(text(el.querySelector('.notice'))).toContain("isn't switched on yet");
  });

  it('saves a changed approval policy, and only when it has changed', () => {
    render();
    const component = fixture.componentInstance;

    component.saveSettings();
    expect(updateSettings).not.toHaveBeenCalled();

    component.policy.setValue(StudioApprovalPolicy.AdminAndSalesManager);
    expect(component.policyDirty()).toBeTrue();
    component.saveSettings();

    expect(updateSettings).toHaveBeenCalledWith({ approvalPolicy: StudioApprovalPolicy.AdminAndSalesManager });
    expect(component.policyDirty()).toBeFalse();
  });
});

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SharedModule } from '../../shared/shared.module';
import { CampaignPerformanceReport } from '../../core/models/report.model';
import { ReportsComponent } from './reports.component';

const row = {
  campaignId: 'c1',
  name: 'Diwali offer',
  status: 'Completed',
  audience: 100,
  contacted: 90,
  messagesSent: 90,
  delivered: 80,
  read: 40,
  failed: 2,
  responded: 10,
  optedOut: 1,
  handedOff: 3,
  deliveryRate: 0.8889,
  readRate: 0.5,
  responseRate: null,
  optOutRate: 0.0111,
};

describe('ReportsComponent', () => {
  let fixture: ComponentFixture<ReportsComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReportsComponent],
      imports: [SharedModule, HttpClientTestingModule, RouterTestingModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(ReportsComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the campaign report for the default 30-day window and renders a row', () => {
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url.endsWith('/reports/campaign-performance'));
    expect(req.request.params.get('days')).toBe('30');
    const report: CampaignPerformanceReport = {
      window: { days: 30, from: '2026-08-22T00:00:00Z', to: '2026-09-21T00:00:00Z' },
      campaigns: [row],
      totals: row,
    };
    req.flush(report);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Diwali offer');
    // A null rate is a missing denominator, not zero.
    expect(text).toContain('—');
  });

  it('drops a response that arrives after the window changed', () => {
    fixture.detectChanges();
    const stale = http.expectOne((r) => r.url.endsWith('/reports/campaign-performance'));

    fixture.componentInstance.setWindow(90);
    const fresh = http.expectOne((r) => r.url.endsWith('/reports/campaign-performance') && r.params.get('days') === '90');

    fresh.flush({ window: { days: 90, from: '', to: '' }, campaigns: [], totals: row });
    stale.flush({ window: { days: 30, from: '', to: '' }, campaigns: [{ ...row, name: 'Stale' }], totals: row });
    fixture.detectChanges();

    expect(fixture.componentInstance.campaigns.data?.window.days).toBe(90);
  });
});

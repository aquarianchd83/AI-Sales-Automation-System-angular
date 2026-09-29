import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject } from 'rxjs';

import { TenantJobListComponent } from './tenant-job-list.component';
import { TenantJob } from '../../../core/models/tenant-job.model';
import { NotificationHubService } from '../../../core/services/notification-hub.service';
import { SharedModule } from '../../shared.module';
import { environment } from '../../../../environments/environment';

function job(jobType: string, displayName: string): TenantJob {
  return {
    jobType,
    displayName,
    description: '',
    cronExpression: '0 6,18 * * *',
    defaultCron: '0 6,18 * * *',
    isEnabled: true,
    isRegistered: true,
    nextExecutionUtc: null,
    lastExecutionUtc: null,
    hangfireLastJobState: null,
    lastRunAtUtc: null,
    lastRunOutcome: null,
    lastRunSummary: null,
    lastRunDurationMs: null,
    consecutiveFailureCount: 0,
  };
}

describe('TenantJobListComponent', () => {
  let fixture: ComponentFixture<TenantJobListComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TenantJobListComponent);
  });

  afterEach(() => http.verify());

  const respond = () =>
    http.expectOne(`${environment.apiBaseUrl}/jobs`).flush({
      runsBackgroundJobs: true,
      jobs: [
        job('campaign-follow-ups', 'Campaign follow-ups'),
        job('campaign-completion', 'Campaign completion'),
        job('lead-discovery', 'Lead discovery'),
      ],
    });

  it('lists every job by default', () => {
    fixture.detectChanges();
    respond();
    fixture.detectChanges();

    expect(fixture.componentInstance.jobs.length).toBe(3);
  });

  it('narrows to the requested job types and drops the page chrome when embedded', () => {
    fixture.componentInstance.jobTypes = ['campaign-follow-ups', 'campaign-completion'];
    fixture.componentInstance.embedded = true;
    fixture.detectChanges();
    respond();
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(fixture.componentInstance.jobs.map((j) => j.jobType)).toEqual(['campaign-follow-ups', 'campaign-completion']);
    expect(text).toContain('Campaign completion');
    expect(text).not.toContain('Lead discovery');
    expect(fixture.nativeElement.querySelector('app-page-header')).toBeNull();
  });
});

describe('TenantJobListComponent live refresh', () => {
  it('refetches its rows quietly when one of its jobs finishes', () => {
    const finished$ = new Subject<string>();
    TestBed.configureTestingModule({
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: NotificationHubService, useValue: { jobFinished: () => finished$.asObservable() } }],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TenantJobListComponent);
    fixture.componentInstance.jobTypes = ['campaign-completion'];
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/jobs`).flush({ runsBackgroundJobs: true, jobs: [job('campaign-completion', 'Campaign completion')] });
    fixture.detectChanges();
    expect(fixture.componentInstance.jobs[0].lastRunAtUtc).toBeNull();

    finished$.next('campaign-completion');
    const refetch = http.expectOne(`${environment.apiBaseUrl}/jobs`);
    expect(fixture.componentInstance.loading).toBeFalse(); // no spinner for a live refresh
    refetch.flush({
      runsBackgroundJobs: true,
      jobs: [{ ...job('campaign-completion', 'Campaign completion'), lastRunAtUtc: '2026-09-29T10:00:00Z' }],
    });

    expect(fixture.componentInstance.jobs[0].lastRunAtUtc).toBe('2026-09-29T10:00:00Z');
    http.verify();
  });
});

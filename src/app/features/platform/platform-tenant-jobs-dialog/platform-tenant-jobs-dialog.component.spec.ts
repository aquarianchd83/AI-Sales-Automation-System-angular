import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformTenantJob } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformJobService } from '../../../core/services/platform-job.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTenantJobsDialogComponent } from './platform-tenant-jobs-dialog.component';

describe('PlatformTenantJobsDialogComponent', () => {
  let fixture: ComponentFixture<PlatformTenantJobsDialogComponent>;
  let service: { getPaged: jasmine.Spy; trigger: jasmine.Spy; updateSchedule: jasmine.Spy };
  let dialog: { open: jasmine.Spy };
  let notify: { success: jasmine.Spy };

  const job = (jobType: string, displayName: string, patch: Partial<PlatformTenantJob> = {}): PlatformTenantJob =>
    ({
      tenantId: 't1',
      tenantName: 'Confianza IT Solutions',
      tenantStatus: 1,
      jobType,
      displayName,
      description: displayName,
      cronExpression: '0 6 * * *',
      defaultCron: '0 6 * * *',
      isEnabled: true,
      isRegistered: true,
      lastRunAtUtc: null,
      lastRunOutcome: null,
      lastRunDurationMs: null,
      lastRunSummary: null,
      nextExecutionUtc: null,
      consecutiveFailureCount: 0,
      ...patch,
    }) as PlatformTenantJob;

  const rows = (): HTMLElement[] => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tr.mat-mdc-row'));
  const button = (row: HTMLElement, icon: string): HTMLButtonElement =>
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.includes(icon)) as HTMLButtonElement;

  beforeEach(() => {
    service = {
      getPaged: jasmine.createSpy('getPaged').and.returnValue(
        of({
          items: [job('campaign-completion', 'Campaign completion'), job('lead-discovery', 'Lead discovery', { isEnabled: false })],
          totalCount: 2,
          page: 1,
          pageSize: 100,
        })
      ),
      trigger: jasmine.createSpy('trigger').and.returnValue(of({ backgroundJobId: 'bg-9' })),
      updateSchedule: jasmine
        .createSpy('updateSchedule')
        .and.callFake((_t: string, type: string, body: { isEnabled: boolean }) => of(job(type, type, { isEnabled: body.isEnabled }))),
    };
    dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(null) }) };
    notify = { success: jasmine.createSpy('success') };

    TestBed.configureTestingModule({
      declarations: [PlatformTenantJobsDialogComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformJobService, useValue: service },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
        { provide: MAT_DIALOG_DATA, useValue: { tenantId: 't1', tenantName: 'Confianza IT Solutions' } },
      ],
    });
    fixture = TestBed.createComponent(PlatformTenantJobsDialogComponent);
    fixture.detectChanges();
  });

  it('lists every job of the tenant it was opened for, in the same table as the Jobs screen', () => {
    expect(service.getPaged).toHaveBeenCalledWith(jasmine.objectContaining({ tenantId: 't1' }));
    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('Campaign completion');
    expect(rows()[0].textContent).toContain('Running');
    expect(rows()[1].textContent).toContain('Paused');
  });

  it('runs a job now, but not a paused one', () => {
    button(rows()[0], 'play_arrow').click();

    expect(service.trigger).toHaveBeenCalledWith('t1', 'campaign-completion');
    expect(notify.success).toHaveBeenCalled();
    expect(button(rows()[1], 'play_arrow').disabled).toBeTrue();
  });

  it('pauses and resumes a job in place, keeping its schedule', () => {
    button(rows()[0], 'pause').click();

    expect(service.updateSchedule).toHaveBeenCalledWith('t1', 'campaign-completion', { cronExpression: '0 6 * * *', isEnabled: false });
    fixture.detectChanges();
    expect(rows()[0].textContent).toContain('Paused');
  });

  it('opens the schedule editor for a job', () => {
    button(rows()[0], 'schedule').click();

    expect(dialog.open).toHaveBeenCalled();
    expect(dialog.open.calls.mostRecent().args[1].data.job.jobType).toBe('campaign-completion');
  });
});

import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { LeadFollowUp, LeadFollowUpStatus } from '../../core/models/lead-follow-up.model';
import { AuthService } from '../../core/services/auth.service';
import { LeadFollowUpService } from '../../core/services/lead-follow-up.service';
import { NotificationService } from '../../core/services/notification.service';
import { TenantJobService } from '../../core/services/tenant-job.service';
import { SharedModule } from '../../shared/shared.module';
import { FollowUpsComponent } from './follow-ups.component';

const row = (status: LeadFollowUpStatus, name: string, extra: Partial<LeadFollowUp> = {}): LeadFollowUp => ({
  id: `f-${name}`,
  leadId: `lead-${name}`,
  customerId: `c-${name}`,
  customerName: name,
  customerPhoneNumberE164: '+919000000000',
  leadStage: 'Qualified',
  status,
  dueAt: '2027-01-10T06:00:00Z',
  intervalMonths: 3,
  reason: 'Budget frozen',
  messageTemplateId: 't-1',
  messageTemplateName: 'Check in',
  followUpNumber: 1,
  sentAt: null,
  outcomeNote: null,
  createdAt: '2026-10-10T06:00:00Z',
  ...extra,
});

const jobRow = (isEnabled: boolean) => ({
  jobType: 'lead-follow-ups', displayName: 'Lead follow-ups', description: '', cronExpression: '15 * * * *', defaultCron: '15 * * * *',
  isEnabled, isRegistered: isEnabled, nextExecutionUtc: null, lastExecutionUtc: null, hangfireLastJobState: null,
  lastRunAtUtc: '2026-10-15T07:15:14Z', lastRunOutcome: null, lastRunSummary: null, lastRunDurationMs: null, consecutiveFailureCount: 0,
});

describe('FollowUpsComponent', () => {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(items: LeadFollowUp[], opts: { admin?: boolean; jobEnabled?: boolean; dueNow?: number; months?: number } = {}) {
    const getPaged = jasmine.createSpy('getPaged').and.returnValue(of({ items, totalCount: items.length, page: 1, pageSize: 25, totalPages: 1 }));
    const getSummary = jasmine.createSpy('getSummary').and.returnValue(of({ scheduled: 4, dueNow: opts.dueNow ?? 1, dueWithin30Days: 2, sent: 7, suggested: 3 }));
    const getSetting = jasmine.createSpy('getSetting').and.returnValue(of({ months: opts.months ?? 2, maxMonths: 12 }));
    const saveSetting = jasmine.createSpy('saveSetting').and.callFake((months: number) => of({ months, maxMonths: 12 }));
    const getJobs = jasmine.createSpy('getJobs').and.returnValue(of({ runsBackgroundJobs: true, jobs: [jobRow(opts.jobEnabled ?? true)] }));
    const updateSchedule = jasmine.createSpy('updateSchedule').and.callFake((_t: string, r: { isEnabled: boolean }) => of(jobRow(r.isEnabled)));
    const trigger = jasmine.createSpy('trigger').and.returnValue(of({ recurringJobId: 'r', backgroundJobId: 'b' }));

    TestBed.configureTestingModule({
      declarations: [FollowUpsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadFollowUpService, useValue: { getPaged, getSummary, getSetting, saveSetting } },
        { provide: TenantJobService, useValue: { getJobs, updateSchedule, trigger } },
        { provide: AuthService, useValue: { hasAnyRole: () => opts.admin !== false } },
        { provide: NotificationService, useValue: { success: () => undefined } },
      ],
    });

    const fixture = TestBed.createComponent(FollowUpsComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement, getPaged, saveSetting, updateSchedule, trigger };
  }

  it('opens on the waiting follow-ups, with no status filter', () => {
    const { getPaged } = render([]);

    expect(getPaged.calls.mostRecent().args.slice(1)).toEqual([undefined, undefined]);
  });

  it('has the Lead, Follow-up on and Scheduled date columns, with no "All leads" button', () => {
    const { root } = render([row(LeadFollowUpStatus.Scheduled, 'Asha')]);

    const headers = Array.from(root.querySelectorAll('th')).map((h) => text(h));
    expect(headers.slice(0, 3)).toEqual(['Lead', 'Follow-up on', 'Scheduled date']);
    expect(text(root)).not.toContain('All leads');
    expect(text(root.querySelector('[data-testid="follow-up-on"]'))).toContain('2026');
    expect(text(root.querySelector('[data-testid="scheduled-date"]'))).toContain('2027');
    expect(text(root.querySelector('[data-testid="scheduled-date"]'))).toContain('+3 months');
    expect(text(root.querySelector('tr.mat-mdc-row'))).toContain('Budget frozen');
  });

  it('narrows to what is due in 30 days, or switches to a history outcome', () => {
    const { fixture, component, getPaged } = render([]);

    component.viewControl.setValue('due30');
    fixture.detectChanges();
    expect(getPaged.calls.mostRecent().args.slice(1)).toEqual([undefined, 30]);

    component.viewControl.setValue('Sent');
    fixture.detectChanges();
    expect(getPaged.calls.mostRecent().args.slice(1)).toEqual(['Sent', undefined]);
  });

  it('offers send, change date and cancel only where a person can still act', () => {
    const { root } = render([
      row(LeadFollowUpStatus.Scheduled, 'Asha'),
      row(LeadFollowUpStatus.Failed, 'Ravi', { outcomeNote: 'rejected' }),
      row(LeadFollowUpStatus.Sent, 'Meena'),
      row(LeadFollowUpStatus.Skipped, 'Dev', { outcomeNote: 'Customer got in touch' }),
    ]);

    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row'));
    const actions = rows.map((r) => Array.from(r.querySelectorAll('.actions-cell button')).map((b) => text(b)));

    expect(actions).toEqual([['Send now', 'Change date', 'Cancel'], ['Try again', 'Change date', 'Dismiss'], [], []]);
  });

  it('lets a suggestion be approved on the lead or dismissed - never sent from here', () => {
    const { root } = render([row(LeadFollowUpStatus.Suggested, 'Asha', { messageTemplateId: null, messageTemplateName: null })]);

    const actions = Array.from(root.querySelectorAll('tr.mat-mdc-row .actions-cell button')).map((b) => text(b));
    expect(actions).toEqual(['Approve', 'Change date', 'Dismiss']);
    expect(text(root.querySelector('tr.mat-mdc-row'))).toContain('Suggested by AI');
    expect(text(root.querySelector('[data-testid="follow-up-on"]'))).toContain('from the WhatsApp chat');
  });

  it('says why one was skipped', () => {
    const { root } = render([row(LeadFollowUpStatus.Skipped, 'Dev', { outcomeNote: 'Customer got in touch' })]);

    expect(text(root.querySelector('tr.mat-mdc-row'))).toContain('Customer got in touch');
  });

  it('marks a waiting follow-up whose date has passed as due', () => {
    const { root } = render([row(LeadFollowUpStatus.Scheduled, 'Asha', { dueAt: '2020-01-01T00:00:00Z' })]);

    expect(text(root.querySelector('tr.mat-mdc-row'))).toContain('Due - waiting');
  });

  it('loads the months setting, lights the matching choice, and saves a new one', () => {
    const { fixture, component, root, saveSetting } = render([], { months: 2 });

    expect(component.monthsControl.value).toBe(2);
    expect(root.querySelector('[data-testid="months-2"]')?.classList).toContain('on');
    expect((root.querySelector('[data-testid="save-setting"]') as HTMLButtonElement).disabled).toBeTrue();

    (root.querySelector('[data-testid="months-3"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (root.querySelector('[data-testid="save-setting"]') as HTMLButtonElement).click();

    expect(saveSetting).toHaveBeenCalledWith(3);
  });

  it('opens the 4 to 12 month picker for Custom', () => {
    const { fixture, component, root } = render([], { months: 2 });

    (root.querySelector('[data-testid="months-custom"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="custom-months"]')).not.toBeNull();
    expect(component.monthsControl.value).toBe(4);
    expect(component.customMonths).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('warns when follow-ups are due but sending is paused, and resumes it', () => {
    const { fixture, root, updateSchedule } = render([], { jobEnabled: false, dueNow: 3 });

    expect(text(root.querySelector('[data-testid="paused-warning"]'))).toContain('3 follow-ups are due but sending is paused');
    (root.querySelector('[data-testid="toggle-sending"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(updateSchedule).toHaveBeenCalledWith('lead-follow-ups', { cronExpression: '15 * * * *', isEnabled: true });
    expect(root.querySelector('[data-testid="paused-warning"]')).toBeNull();
  });

  it('shows no warning while sending is active, and can check now', () => {
    const { root, trigger } = render([], { jobEnabled: true, dueNow: 3 });

    expect(root.querySelector('[data-testid="paused-warning"]')).toBeNull();
    (root.querySelector('[data-testid="check-now"]') as HTMLButtonElement).click();
    expect(trigger).toHaveBeenCalledWith('lead-follow-ups');
  });

  it('hides the sender card and the save button from anyone but the tenant Admin', () => {
    const { root } = render([], { admin: false });

    expect(root.querySelector('[data-testid="job-bar"]')).toBeNull();
    expect(root.querySelector('[data-testid="save-setting"]')).toBeNull();
  });
});

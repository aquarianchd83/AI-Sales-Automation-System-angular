import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { QuotaBalance, QuotaType } from '../../../core/models/billing.model';
import { LeadDiscoveryHistoryDay } from '../../../core/models/lead-discovery-history.model';
import { BillingService } from '../../../core/services/billing.service';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantJobService } from '../../../core/services/tenant-job.service';
import { SharedModule } from '../../../shared/shared.module';
import { LeadDiscoveryHistoryListComponent } from './lead-discovery-history-list.component';

function summary(overrides: Partial<LeadDiscoveryHistoryDay['executions'][number]> = {}): LeadDiscoveryHistoryDay['executions'][number] {
  return {
    id: 'e1',
    processingDate: '2026-09-26T00:00:00Z',
    leadDiscoveryProfileId: 'p1',
    profileName: 'Eye clinic',
    trigger: 'Scheduled',
    status: 'Completed',
    startedAtUtc: '2026-09-26T09:00:00Z',
    endedAtUtc: '2026-09-26T09:05:00Z',
    lockStatus: 'Released',
    quotaExhausted: false,
    customersDiscovered: 5,
    customersCreated: 3,
    customersDuplicate: 2,
    customersInvalid: 0,
    customersFailed: 0,
    customersSkipped: 0,
    autoCampaignConfigured: true,
    autoCampaignId: 'c1',
    referredCampaignId: 'c1',
    referredCampaignName: 'Welcome New Leads',
    generatedCampaignId: 'c2',
    generatedCampaignName: 'Welcome New Leads - 2026-09-26',
    campaignStatus: 'Created',
    campaignNote: 'Campaign created.',
    templateStatus: 'Completed',
    mappingStatus: 'Completed',
    mappingsEligible: 3,
    mappingsCreated: 3,
    mappingsExisting: 0,
    mappingsFailed: 0,
    rootExecutionId: 'e1',
    retryOfExecutionId: null,
    supersededByExecutionId: null,
    retryCount: 0,
    lastRetryAtUtc: null,
    failedStep: null,
    errorMessage: null,
    nextRetryInfo: null,
    canRetry: false,
    estimatedCostLocal: 35.28,
    currencyCode: 'INR',
    currencySymbol: '₹',
    ...overrides,
  };
}

describe('LeadDiscoveryHistoryListComponent', () => {
  let fixture: ComponentFixture<LeadDiscoveryHistoryListComponent>;
  let component: LeadDiscoveryHistoryListComponent;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let tenantJobs: jasmine.SpyObj<TenantJobService>;
  let billing: jasmine.SpyObj<BillingService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(days: LeadDiscoveryHistoryDay[]): void {
    service.getHistory.and.returnValue(of({ items: days, totalCount: days.length, page: 1, pageSize: 25, totalPages: 1 }));
    fixture = TestBed.createComponent(LeadDiscoveryHistoryListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('LeadDiscoveryService', ['getHistory', 'retryExecution']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    tenantJobs = jasmine.createSpyObj('TenantJobService', ['trigger']);
    billing = jasmine.createSpyObj('BillingService', ['getQuota']);
    billing.getQuota.and.returnValue(of([]));

    TestBed.configureTestingModule({
      declarations: [LeadDiscoveryHistoryListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
        { provide: NotificationService, useValue: notify },
        { provide: TenantJobService, useValue: tenantJobs },
        { provide: BillingService, useValue: billing },
      ],
    });
  });

  it('groups executions by processing date and shows their status', () => {
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary()] }]);

    expect(service.getHistory).toHaveBeenCalledWith({ page: 1, pageSize: 25, status: undefined });
    expect(text()).toContain('Eye clinic');
    expect(text()).toContain('Completed');
    expect(text()).toContain('Welcome New Leads - 2026-09-26');
    expect(text()).toContain('₹35.28');
  });

  it('shows how much lead-candidate quota is left in the header, not used/all, with Top up alongside it', () => {
    const balances: QuotaBalance[] = [
      { quotaType: QuotaType.LeadCandidates, balance: 180, capacity: 1000, grants: [] },
      { quotaType: QuotaType.WhatsAppMessages, balance: 50, capacity: 500, grants: [] },
    ];
    billing.getQuota.and.returnValue(of(balances));

    create([]);

    expect(component.quotaLabel).toBe('180');
    const chip = (fixture.nativeElement as HTMLElement).querySelector('.quota-chip');
    // Labelled, not a bare number, so it reads on its own rather than as a stray parenthetical.
    expect(chip?.textContent).toContain('180 lead candidates left');
    // Top up lives inside the quota chip, not as a separate header button.
    expect(chip?.querySelector<HTMLAnchorElement>('a[href="/billing/wallet"]')?.textContent).toContain('Top up');
  });

  it('hides the quota chip - and its Top up link - when the tenant has never had any lead-candidate quota', () => {
    billing.getQuota.and.returnValue(of([{ quotaType: QuotaType.LeadCandidates, balance: 0, capacity: 0, grants: [] }]));

    create([]);

    expect(component.quotaLabel).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.quota-chip')).toBeNull();
  });

  it('re-queries with the chosen status filter', fakeAsync(() => {
    create([]);

    component.statusControl.setValue('Failed');
    tick();

    expect(service.getHistory).toHaveBeenCalledWith({ page: 1, pageSize: 25, status: 'Failed' });
  }));

  it('navigates to the execution detail page for a row', () => {
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary()] }]);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('tr.clickable-row')!.click();

    expect(navigate).toHaveBeenCalledWith(['e1'], jasmine.objectContaining({ relativeTo: jasmine.anything() }));
  });

  it('does not navigate when the retry button is clicked', () => {
    service.retryExecution.and.returnValue(of({ executionId: 'e1', backgroundJobId: 'job-1' }));
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary({ canRetry: true })] }]);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('button[matTooltip*="Retry"]')!.click();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('retries a retryable execution and reloads', () => {
    service.retryExecution.and.returnValue(of({ executionId: 'e1', backgroundJobId: 'job-1' }));
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary({ canRetry: true })] }]);

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('button[matTooltip*="Retry"]');
    button!.click();
    fixture.detectChanges();

    expect(service.retryExecution).toHaveBeenCalledWith('e1');
    expect(notify.success).toHaveBeenCalled();
    expect(service.getHistory).toHaveBeenCalledTimes(2);
  });

  it('shows an error notification when retry is refused', () => {
    service.retryExecution.and.returnValue(throwError(() => ({ error: { message: 'Already retried.' } })));
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary({ canRetry: true })] }]);

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('button[matTooltip*="Retry"]');
    button!.click();
    fixture.detectChanges();

    expect(notify.error).toHaveBeenCalledWith('Already retried.');
  });

  it('hides the retry button when the execution cannot be retried', () => {
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary({ canRetry: false })] }]);

    expect((fixture.nativeElement as HTMLElement).querySelector('button[matTooltip*="Retry"]')).toBeNull();
  });

  it('shows an empty state with no executions', () => {
    create([]);

    expect(text()).toContain('No lead discovery executions yet.');
  });

  it('offers to buy credits on a quota-exhausted row, without navigating to the execution', () => {
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary({ quotaExhausted: true })] }]);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    expect(text()).toContain('Buy credits');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.quota-row a[href="/billing/wallet"]')!.click();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('hides the row-level buy-credits link when the quota was not exhausted', () => {
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary({ quotaExhausted: false })] }]);

    expect((fixture.nativeElement as HTMLElement).querySelector('.quota-row a[href="/billing/wallet"]')).toBeNull();
  });

  it('links to Discovery profile from the page header, and has no Customers link', () => {
    create([]);

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector<HTMLAnchorElement>('a[href="/lead-discovery/profile"]')).not.toBeNull();
    expect(root.querySelector<HTMLAnchorElement>('a[href="/customers"]')).toBeNull();
  });

  it('queues a run now and shows the job id', () => {
    tenantJobs.trigger.and.returnValue(of({ recurringJobId: 'lead-discovery', backgroundJobId: 'job-1' }));
    create([]);

    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Run now')
    ) as HTMLButtonElement).click();

    expect(tenantJobs.trigger).toHaveBeenCalledWith('lead-discovery');
    expect(notify.success).toHaveBeenCalledWith('Lead discovery queued (job job-1).');
  });

  it('shows an error notification when the run cannot be queued', () => {
    tenantJobs.trigger.and.returnValue(throwError(() => ({ error: { message: 'Lead discovery is disabled.' } })));
    create([]);

    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Run now')
    ) as HTMLButtonElement).click();

    expect(notify.error).toHaveBeenCalledWith('Lead discovery is disabled.');
  });

  it('re-polls the list a few times after a successful run now, so the new execution shows up on its own', fakeAsync(() => {
    tenantJobs.trigger.and.returnValue(of({ recurringJobId: 'lead-discovery', backgroundJobId: 'job-1' }));
    create([]);
    const callsBeforeRun = service.getHistory.calls.count();

    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Run now')
    ) as HTMLButtonElement).click();

    tick(5000);
    expect(service.getHistory.calls.count()).toBe(callsBeforeRun + 1);
    tick(5000);
    expect(service.getHistory.calls.count()).toBe(callsBeforeRun + 2);

    tick(4 * 5000); // the remaining scheduled polls (6 total)
    const callsAfterAllPolls = service.getHistory.calls.count();
    expect(callsAfterAllPolls).toBe(callsBeforeRun + 6);

    tick(5000); // polling has stopped - no further reload
    expect(service.getHistory.calls.count()).toBe(callsAfterAllPolls);

    discardPeriodicTasks();
  }));

  it('does not poll after a failed run now', fakeAsync(() => {
    tenantJobs.trigger.and.returnValue(throwError(() => ({ error: { message: 'Lead discovery is disabled.' } })));
    create([]);
    const callsBeforeRun = service.getHistory.calls.count();

    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Run now')
    ) as HTMLButtonElement).click();

    tick(30000);
    expect(service.getHistory.calls.count()).toBe(callsBeforeRun);
  }));
});

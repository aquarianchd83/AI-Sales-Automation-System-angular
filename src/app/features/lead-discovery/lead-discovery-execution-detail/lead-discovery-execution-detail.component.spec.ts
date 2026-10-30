import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import {
  LeadDiscoveryExecutionCustomer,
  LeadDiscoveryExecutionDetail,
  LeadDiscoveryExecutionSummary,
} from '../../../core/models/lead-discovery-history.model';
import { LeadDiscoveryRun } from '../../../core/models/lead-discovery.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CustomerHistoryDialogComponent } from '../../../shared/components/customer-history-dialog/customer-history-dialog.component';
import { SharedModule } from '../../../shared/shared.module';
import { LeadDiscoveryExecutionDetailComponent } from './lead-discovery-execution-detail.component';

function execution(overrides: Partial<LeadDiscoveryExecutionSummary> = {}): LeadDiscoveryExecutionSummary {
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
    customersDiscovered: 7,
    customersCreated: 3,
    customersDuplicate: 2,
    customersInvalid: 1,
    customersFailed: 0,
    customersSkipped: 1,
    autoCampaignConfigured: false,
    autoCampaignId: null,
    referredCampaignId: null,
    referredCampaignName: null,
    generatedCampaignId: null,
    generatedCampaignName: null,
    campaignStatus: 'Skipped',
    campaignNote: null,
    templateStatus: 'Skipped',
    mappingStatus: 'Skipped',
    mappingsEligible: 0,
    mappingsCreated: 0,
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

function run(overrides: Partial<LeadDiscoveryRun> = {}): LeadDiscoveryRun {
  return {
    id: 'r1',
    ranAtUtc: '2026-09-27T00:57:15Z',
    model: 'claude-sonnet-5',
    rounds: 3,
    candidatesConsidered: 14,
    leadsSaved: 10,
    duplicates: 2,
    rejected: 2,
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    webSearches: 4,
    webFetches: 6,
    estimatedCostUsd: 0.42,
    estimatedCostLocal: 35.28,
    executionId: 'e1',
    costPerLeadUsd: 0.042,
    costPerLeadLocal: 3.528,
    ...overrides,
  };
}

function detail(
  overrides: Partial<LeadDiscoveryExecutionSummary> = {},
  research: LeadDiscoveryRun | null = run()
): LeadDiscoveryExecutionDetail {
  return {
    execution: execution(overrides),
    lockKey: 'lead-discovery:p1',
    lockTokenReference: null,
    lockOwnerInstanceId: null,
    lockAcquiredAtUtc: null,
    lockExpiresAtUtc: null,
    lockLastRenewedAtUtc: null,
    errorDetails: null,
    summary: null,
    customers: [],
    templates: [],
    lockTransitions: [],
    research,
    currencyCode: 'INR',
    currencySymbol: '₹',
    verificationCounts: { passed: 0, failed: 0, pending: 0, error: 0, notChecked: 0 },
  };
}

const row = (over: Partial<LeadDiscoveryExecutionCustomer>): LeadDiscoveryExecutionCustomer => ({
  id: 'r1',
  customerId: 'c1',
  discoveredLeadId: 'l1',
  customerName: 'Eye clinic 1',
  phone: '+919800000001',
  status: 'Created',
  isInvalid: false,
  errorMessage: null,
  errorDetails: null,
  retriedFromId: null,
  processedAtUtc: null,
  verificationStatus: 'Pass',
  verificationReasonCode: null,
  verificationReason: null,
  verifiedAtUtc: null,
  crmCustomerName: 'Sim Owner 1',
  ...over,
});

describe('LeadDiscoveryExecutionDetailComponent', () => {
  let fixture: ComponentFixture<LeadDiscoveryExecutionDetailComponent>;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(): void {
    fixture = TestBed.createComponent(LeadDiscoveryExecutionDetailComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('LeadDiscoveryService', ['getExecution', 'retryExecution']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    TestBed.configureTestingModule({
      declarations: [LeadDiscoveryExecutionDetailComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: dialog },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'e1' })) } },
      ],
    });
  });

  it('loads the execution named in the route and shows its customer counts', () => {
    service.getExecution.and.returnValue(of(detail()));
    create();

    expect(service.getExecution).toHaveBeenCalledWith('e1');
    expect(text()).toContain('Eye clinic');
    expect(text()).toContain('Found');
    expect(text()).toContain('Skipped');
    expect(text()).toContain('Auto-Campaign is not configured.');
    expect(text()).toContain('₹35.28');
    expect(text()).toContain('₹3.53/lead');
    expect(text()).toContain('claude-sonnet-5');
  });

  it('explains an execution with no AI research', () => {
    service.getExecution.and.returnValue(of(detail({}, null)));
    create();

    expect(text()).toContain('No AI research was recorded for this execution');
  });

  it('explains a quota-exhausted execution and offers to buy credits', () => {
    service.getExecution.and.returnValue(of(detail({ quotaExhausted: true, customersDiscovered: 0 })));
    create();

    expect(text()).toContain('Lead-candidate quota ran out partway through');
    expect(text()).toContain('The quota ran out before any customers were discovered.');
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href="/billing/wallet"]');
    expect(link?.textContent).toContain('Buy credits');
  });

  it('shows the real reason, and not "out of credits", when a monthly limit stopped the run', () => {
    const reason = 'Lead discovery has used its monthly limit of 25 credits. Your wallet still has 813 credits.';
    service.getExecution.and.returnValue(of(detail({ quotaExhausted: false, quotaStopReason: reason, customersDiscovered: 0 })));
    create();

    expect(text()).toContain(reason);
    expect(text()).not.toContain('Lead-candidate quota ran out partway through');
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/billing/wallet"]')?.textContent).toContain('Open wallet');
  });

  it('has no buy-credits link when the quota was not exhausted', () => {
    service.getExecution.and.returnValue(of(detail({ quotaExhausted: false })));
    create();

    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/billing/wallet"]')).toBeNull();
  });

  it('shows an error state when the execution cannot be loaded', () => {
    service.getExecution.and.returnValue(throwError(() => ({ status: 404 })));
    create();

    expect(text()).toContain('This execution could not be loaded.');
  });

  it('retries and returns to the history list', () => {
    service.getExecution.and.returnValue(of(detail({ canRetry: true, status: 'Failed' })));
    service.retryExecution.and.returnValue(of({ executionId: 'e2', backgroundJobId: 'job-1' }));
    create();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Retry')
    );
    button!.click();

    expect(service.retryExecution).toHaveBeenCalledWith('e1');
    expect(notify.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['..'], jasmine.anything());
  });

  describe('DND check results', () => {
    const rows = (): LeadDiscoveryExecutionCustomer[] => [
      row({ id: 'r1', verificationStatus: 'Pass' }),
      row({ id: 'r2', customerId: null, status: 'Skipped', verificationStatus: 'Fail' }),
      row({ id: 'r3', customerId: null, status: 'Pending', verificationStatus: 'Error' }),
      row({ id: 'r4', customerId: null, status: 'Skipped', verificationStatus: 'NotChecked' }),
    ];

    function createWithCounts(customers: LeadDiscoveryExecutionCustomer[], counts = { passed: 1, failed: 1, pending: 0, error: 1, notChecked: 1 }): void {
      service.getExecution.and.returnValue(of({ ...detail(), customers, verificationCounts: counts }));
      create();
    }

    const tableRows = () => (fixture.nativeElement as HTMLElement).querySelectorAll('tr.mat-mdc-row, tr[mat-row]').length;

    it('shows how the numbers came out when the check ran', () => {
      createWithCounts(rows());

      const t = text();
      expect(t).toContain('DND passed');
      expect(t).toContain('DND failed (no customer)');
      expect(t).toContain('Check error (retry)');
    });

    it('shows no DND counts or filter when the check did not run', () => {
      createWithCounts([row({ verificationStatus: 'NotChecked' })], { passed: 0, failed: 0, pending: 0, error: 0, notChecked: 1 });

      expect(text()).not.toContain('DND passed');
      expect((fixture.nativeElement as HTMLElement).querySelector('.customer-filter')).toBeNull();
    });

    it('does not repeat the rejection reason or the campaign as columns of their own', () => {
      createWithCounts([
        row({ id: 'r1', verificationStatus: 'Pass', campaignName: 'Eye clinic - 2026-10-15' }),
        row({ id: 'r2', customerId: null, status: 'Skipped', verificationStatus: 'Fail', verificationReason: 'On the DND register', errorMessage: 'Rejected by the DND check - no customer created.' }),
      ]);

      const headers = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('th')).map((h) => h.textContent?.trim());
      expect(headers).not.toContain('Rejection / failure reason');
      expect(headers).not.toContain('Campaign');
      expect(text()).toContain('Rejected by the DND check');   // the rejection is still on the row, in the Note column
    });

    it('says in words why a row got no consent SMS, with a cross, and links the Off case to the discovery profile', () => {
      createWithCounts([
        row({ id: 'r1', consentSmsNote: 'Not sent: the consent SMS was Off', consentSmsNeedsSetting: true }),
        row({ id: 'r2', customerId: null, status: 'Skipped', verificationStatus: 'NotChecked', consentSmsNote: 'Not sent: Not applicable' }),
        row({ id: 'r3', customerId: null, status: 'Skipped', verificationStatus: 'Fail', consentSmsNote: 'Not sent: the number failed the DND check, so no customer was created to invite.' }),
        row({ id: 'r4', customerId: null, status: 'Skipped', verificationStatus: 'NotChecked' }),
      ]);

      const cells = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('td.mat-column-consentSms'));
      expect(cells.length).toBe(4);
      const textOf = (i: number) => cells[i].textContent?.replace(/\s+/g, ' ').trim() ?? '';

      expect(textOf(0)).toContain('Not sent: the consent SMS was Off');
      expect(textOf(1)).toContain('Not sent: Not applicable');
      expect(textOf(2)).toContain('failed the DND check');
      expect(textOf(3)).toContain('Not sent');   // an older execution with no note still says so
      cells.forEach((cell, i) => {
        expect(cell.querySelector('mat-icon.sms-icon--not-sent')?.textContent?.trim()).withContext('row ' + i).toBe('close');
        expect(cell.querySelector('mat-icon.sms-icon--sent')).withContext('row ' + i).toBeNull();
      });

      // Only the Off case links to the setting.
      const links = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.sms-link');
      expect(links.length).toBe(1);
      expect(links[0].getAttribute('href')).toBe('/lead-discovery/profile');
      expect(cells[0].contains(links[0])).toBeTrue();
    });

    it('shows a tick for an SMS that was sent, a cross for one that failed, and when the customer answered', () => {
      createWithCounts([
        row({ id: 'r1', consentSmsStatus: 'Delivered', consentRecordedAtUtc: '2026-10-15T06:30:00Z' }),
        row({ id: 'r2', customerId: 'c2', consentSmsStatus: 'Submitted' }),
        row({ id: 'r3', customerId: 'c3', consentSmsStatus: 'Failed', consentSmsFailureReason: 'Number is unreachable' }),
      ]);

      const cells = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('td.mat-column-consentSms'));
      expect(cells.length).toBe(3);
      expect(cells[0].querySelector('mat-icon.sms-icon--sent')?.textContent?.trim()).toBe('check');
      expect(cells[0].textContent).toContain('Delivered');
      expect(cells[0].textContent).toContain('Replied');
      expect(cells[1].querySelector('mat-icon.sms-icon--sent')?.textContent?.trim()).toBe('check');
      expect(cells[1].textContent).toContain('Submitted');
      expect(cells[2].querySelector('mat-icon.sms-icon--not-sent')?.textContent?.trim()).toBe('close');
      expect(cells[2].querySelector('mat-icon.sms-icon--sent')).toBeNull();
      expect(cells[2].textContent).toContain('Failed');
    });

    it('filters the customers by DND check result and shows the checked-at time column', () => {
      createWithCounts(rows());
      expect(tableRows()).toBe(4);
      expect(text()).toContain('Checked at');

      fixture.componentInstance.verificationFilter = 'Fail';
      fixture.detectChanges();

      expect(tableRows()).toBe(1);
      expect(text()).toContain('1 of 4');
    });
  });

  describe('customer history icon', () => {
    function createWith(customers: LeadDiscoveryExecutionCustomer[]): void {
      service.getExecution.and.returnValue(of({ ...detail(), customers }));
      create();
    }

    it('is shown on a row with a customer, and opens the history of that customer', () => {
      createWith([row({})]);

      const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.history-button');
      expect(buttons.length).toBe(1);
      buttons[0].click();

      expect(dialog.open).toHaveBeenCalledWith(
        CustomerHistoryDialogComponent,
        jasmine.objectContaining({ data: { customerId: 'c1', displayName: 'Sim Owner 1' } })
      );
    });

    it('is shown on a row with no customer too, and opens the record of what happened to that business', () => {
      createWith([
        row({ id: 'r2', customerId: null, crmCustomerName: null, status: 'Skipped', verificationStatus: 'Fail', verificationReasonCode: 'DND', errorMessage: 'Rejected by the DND check' }),
      ]);

      const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.history-button');
      expect(buttons.length).toBe(1);
      buttons[0].click();

      const config = dialog.open.calls.mostRecent().args[1] as { data: { customerId?: string; displayName: string; events: { eventType: string }[] } };
      expect(config.data.customerId).toBeUndefined();
      expect(config.data.displayName).toBe('Eye clinic 1');
      expect(config.data.events.map((e) => e.eventType)).toContain('VerificationFailed');
    });
  });
});

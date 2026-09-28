import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { LeadDiscoveryExecutionDetail, LeadDiscoveryExecutionSummary } from '../../../core/models/lead-discovery-history.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
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
    ...overrides,
  };
}

function detail(overrides: Partial<LeadDiscoveryExecutionSummary> = {}): LeadDiscoveryExecutionDetail {
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
  };
}

describe('LeadDiscoveryExecutionDetailComponent', () => {
  let fixture: ComponentFixture<LeadDiscoveryExecutionDetailComponent>;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(): void {
    fixture = TestBed.createComponent(LeadDiscoveryExecutionDetailComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('LeadDiscoveryService', ['getExecution', 'retryExecution']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      declarations: [LeadDiscoveryExecutionDetailComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
        { provide: NotificationService, useValue: notify },
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
  });

  it('explains a quota-exhausted execution', () => {
    service.getExecution.and.returnValue(of(detail({ quotaExhausted: true, customersDiscovered: 0 })));
    create();

    expect(text()).toContain('Lead-candidate quota ran out partway through');
    expect(text()).toContain('The quota ran out before any customers were discovered.');
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
});

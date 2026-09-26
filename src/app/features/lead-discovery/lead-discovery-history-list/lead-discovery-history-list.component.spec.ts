import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { LeadDiscoveryHistoryDay } from '../../../core/models/lead-discovery-history.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
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
    ...overrides,
  };
}

describe('LeadDiscoveryHistoryListComponent', () => {
  let fixture: ComponentFixture<LeadDiscoveryHistoryListComponent>;
  let component: LeadDiscoveryHistoryListComponent;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialog: jasmine.SpyObj<MatDialog>;

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
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    TestBed.configureTestingModule({
      declarations: [LeadDiscoveryHistoryListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: dialog });
  });

  it('groups executions by processing date and shows their status', () => {
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary()] }]);

    expect(service.getHistory).toHaveBeenCalledWith({ page: 1, pageSize: 25, status: undefined });
    expect(text()).toContain('Eye clinic');
    expect(text()).toContain('Completed');
    expect(text()).toContain('Welcome New Leads - 2026-09-26');
  });

  it('re-queries with the chosen status filter', fakeAsync(() => {
    create([]);

    component.statusControl.setValue('Failed');
    tick();

    expect(service.getHistory).toHaveBeenCalledWith({ page: 1, pageSize: 25, status: 'Failed' });
  }));

  it('opens the execution detail dialog for a row', () => {
    create([{ processingDate: '2026-09-26T00:00:00Z', executions: [summary()] }]);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('tr.clickable-row')!.click();

    expect(dialog.open).toHaveBeenCalledWith(
      jasmine.any(Function),
      jasmine.objectContaining({ data: { executionId: 'e1' } })
    );
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
});

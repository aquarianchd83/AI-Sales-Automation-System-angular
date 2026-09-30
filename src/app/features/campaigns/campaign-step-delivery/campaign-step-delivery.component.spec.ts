import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { CampaignStepDeliveryComponent } from './campaign-step-delivery.component';
import { CampaignStepDeliverySummary, CampaignStepRecipient } from '../../../core/models/campaign.model';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';

const baseUrl = `${environment.apiBaseUrl}/campaigns/camp-1`;

function summary(stepNumber: number, overrides: Partial<CampaignStepDeliverySummary> = {}): CampaignStepDeliverySummary {
  return {
    stepNumber,
    stepType: stepNumber === 0 ? 'Initial' : `FollowUp${stepNumber}`,
    templateName: 'welcome',
    isActive: true,
    recipients: 3,
    queued: 0,
    sent: 0,
    delivered: 1,
    read: 0,
    failed: 1,
    upcoming: 1,
    willNotReceive: 0,
    ...overrides,
  };
}

function recipient(outcome: string, messageId: string | null): CampaignStepRecipient {
  return {
    customerId: `c-${outcome}`,
    phoneNumberE164: '+919000000001',
    firstName: 'Asha',
    lastName: null,
    outcome,
    messageId,
    failureReason: outcome === 'Failed' ? 'Template rejected' : null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    dueAt: null,
    note: null,
  };
}

describe('CampaignStepDeliveryComponent', () => {
  let fixture: ComponentFixture<CampaignStepDeliveryComponent>;
  let http: HttpTestingController;

  const page = (items: CampaignStepRecipient[]) => ({ items, totalCount: items.length, page: 1, pageSize: 10 });

  function flushInitialLoad(items: CampaignStepRecipient[] = [recipient('Failed', 'm1'), recipient('Upcoming', null)]): void {
    http.expectOne(`${baseUrl}/steps/delivery`).flush([summary(0), summary(1)]);
    http
      .expectOne((r) => r.url === `${baseUrl}/steps/0/recipients`)
      .flush(page(items));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CampaignStepDeliveryComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CampaignStepDeliveryComponent);
    fixture.componentInstance.campaignId = 'camp-1';
    fixture.componentInstance.campaignStatus = 'Running';
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('opens the first step and lists its recipients', () => {
    flushInitialLoad();

    const text: string = fixture.nativeElement.textContent;
    expect(fixture.componentInstance.selectedStep).toBe(0);
    expect(text).toContain('Initial');
    expect(text).toContain('FollowUp1');
    expect(text).toContain('Template rejected');
    expect(text).toContain('Will receive');
  });

  it('resends one failed message, then reloads', () => {
    flushInitialLoad();

    fixture.componentInstance.resend(recipient('Failed', 'm1'));
    const retry = http.expectOne(`${baseUrl}/messages/m1/retry`);
    expect(retry.request.method).toBe('POST');
    retry.flush({ sent: true, status: 'Sent', failureReason: null });

    http.expectOne(`${baseUrl}/steps/delivery`).flush([summary(0, { failed: 0 }), summary(1)]);
    http.expectOne((r) => r.url === `${baseUrl}/steps/0/recipients`).flush(page([]));
  });

  it('resends every failed message of the open step', () => {
    flushInitialLoad();

    fixture.componentInstance.resendAllFailed();
    const req = http.expectOne(`${baseUrl}/steps/0/resend-failed`);
    expect(req.request.method).toBe('POST');
    req.flush({ considered: 1, sent: 1, failed: 0, skipped: 0 });

    http.expectOne(`${baseUrl}/steps/delivery`).flush([summary(0, { failed: 0 }), summary(1)]);
    http.expectOne((r) => r.url === `${baseUrl}/steps/0/recipients`).flush(page([]));
  });

  it('cannot resend unless the campaign is Running', () => {
    fixture.componentInstance.campaignStatus = 'Paused';
    flushInitialLoad();

    expect(fixture.componentInstance.canResend).toBeFalse();
    const resendButtons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button[mat-icon-button]'))
      .filter((b) => b.textContent?.includes('replay'));
    expect(resendButtons.length).toBeGreaterThan(0);
    expect(resendButtons.every((b) => b.disabled)).toBeTrue();
  });

  it('filters the open step by outcome', () => {
    flushInitialLoad();

    fixture.componentInstance.setOutcomeFilter('Failed');
    const req = http.expectOne((r) => r.url === `${baseUrl}/steps/0/recipients`);
    expect(req.request.params.get('Outcome')).toBe('Failed');
    req.flush(page([recipient('Failed', 'm1')]));
  });
});

describe('CampaignStepDeliveryComponent status info', () => {
  it('explains the selected status filter under the chips', () => {
    TestBed.configureTestingModule({
      declarations: [CampaignStepDeliveryComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
    });
    const component = TestBed.createComponent(CampaignStepDeliveryComponent).componentInstance;

    expect(component.outcomeFilters.every((f) => !!f.info)).toBeTrue();
    expect(component.selectedFilterInfo).toContain('Everyone attached');

    component.setOutcomeFilter('Failed');
    expect(component.selectedFilterInfo).toContain('resent');
  });
});

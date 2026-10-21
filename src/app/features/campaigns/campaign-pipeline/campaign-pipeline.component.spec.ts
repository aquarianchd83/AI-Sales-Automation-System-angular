import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { CampaignPipelineComponent } from './campaign-pipeline.component';
import { CampaignAudienceMember, CampaignCustomerStatus, CampaignStep } from '../../../core/models/campaign.model';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';

const audienceUrl = `${environment.apiBaseUrl}/campaigns/camp-1/audience`;

const steps: CampaignStep[] = [0, 1].map((n) => ({
  id: `s${n}`,
  stepType: n === 0 ? 'Initial' : `FollowUp${n}`,
  stepNumber: n,
  delayDaysAfterPrevious: 1,
  messageText: null,
  messageTemplateId: null,
  messageTemplateName: null,
  isActive: true,
  mediaAssetIds: [],
}));

function member(i: number, status: string, step = -1): CampaignAudienceMember {
  return {
    customerId: `c${i}`,
    phoneNumberE164: `+91900000000${i}`,
    firstName: `Customer ${i}`,
    lastName: null,
    status,
    currentStepNumber: step,
    lastMessageSentAt: null,
    nextFollowUpDueAt: null,
    stoppedReason: null,
  };
}

describe('CampaignPipelineComponent', () => {
  let fixture: ComponentFixture<CampaignPipelineComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CampaignPipelineComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
    });
    fixture = TestBed.createComponent(CampaignPipelineComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.componentInstance.campaignId = 'camp-1';
    fixture.componentInstance.steps = steps;
  });

  afterEach(() => http.verify());

  function flushPage(items: CampaignAudienceMember[], totalCount = items.length): void {
    http.expectOne((r) => r.url === audienceUrl && r.params.get('Page') === '1').flush({
      items,
      totalCount,
      page: 1,
      pageSize: 100,
      totalPages: Math.ceil(totalCount / 100),
    });
    fixture.detectChanges();
  }

  it('groups the roster into stages and counts them', () => {
    fixture.detectChanges();
    flushPage([member(1, CampaignCustomerStatus.Pending), member(2, CampaignCustomerStatus.AwaitingResponse, 0), member(3, CampaignCustomerStatus.Responded, 0)]);

    const counts = Object.fromEntries(fixture.componentInstance.stages.map((s) => [s.key, s.members.length]));
    expect(counts['queued']).toBe(1);
    expect(counts['step-0']).toBe(1);
    expect(counts['responded']).toBe(1);
  });

  it('shows an empty state when the campaign has no customers', () => {
    fixture.detectChanges();
    flushPage([]);
    expect(fixture.nativeElement.textContent).toContain('No customers in this campaign yet');
  });

  it('shows an error state with a retry when the roster fails to load', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === audienceUrl).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('could not be loaded');
  });

  it('caps the cards per stage and expands in place', () => {
    fixture.detectChanges();
    flushPage(Array.from({ length: 8 }, (_, i) => member(i, CampaignCustomerStatus.Pending)));

    const queued = fixture.componentInstance.stages.find((s) => s.key === 'queued')!;
    expect(fixture.componentInstance.visibleMembers(queued).length).toBe(5);
    expect(fixture.componentInstance.hiddenCount(queued)).toBe(3);
    fixture.componentInstance.showMore(queued);
    expect(fixture.componentInstance.visibleMembers(queued).length).toBe(8);
  });

  it('emits the clicked customer', () => {
    fixture.detectChanges();
    flushPage([member(1, CampaignCustomerStatus.Pending)]);
    const selected: CampaignAudienceMember[] = [];
    fixture.componentInstance.memberSelected.subscribe((m) => selected.push(m));

    (fixture.nativeElement.querySelector('.lead-card') as HTMLButtonElement).click();

    expect(selected.map((m) => m.customerId)).toEqual(['c1']);
  });
});

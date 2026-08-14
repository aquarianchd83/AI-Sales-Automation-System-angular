import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CampaignService } from './campaign.service';
import { environment } from '../../../environments/environment';

describe('CampaignService', () => {
  let service: CampaignService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/campaigns`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CampaignService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('upserts a step at its StepType position', () => {
    const request = {
      stepType: 'FollowUp1',
      delayDaysAfterPrevious: 2,
      messageText: 'Hi {{FirstName}}',
      messageTemplateId: null,
      mediaAssetIds: ['m1', 'm2'],
      isActive: true,
    };
    service.upsertStep('camp-1', request).subscribe();

    const req = http.expectOne(`${baseUrl}/camp-1/steps`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('removes a step by StepType in the URL', () => {
    service.removeStep('camp-1', 'FollowUp1').subscribe();

    const req = http.expectOne(`${baseUrl}/camp-1/steps/FollowUp1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('posts tag names and customer ids to set-audience', () => {
    service.setAudience('camp-1', { tagNames: ['vip'], customerIds: ['c1'] }).subscribe();

    const req = http.expectOne(`${baseUrl}/camp-1/audience`);
    expect(req.request.body).toEqual({ tagNames: ['vip'], customerIds: ['c1'] });
    req.flush({ totalMatched: 1, addedCount: 1, alreadyAttachedCount: 0, notOptedInCount: 0 });
  });

  it('sends lifecycle actions with no request body', () => {
    const check = (call: () => void, url: string) => {
      call();
      const req = http.expectOne(url);
      expect(req.request.body).toBeNull();
      req.flush({});
    };

    check(() => service.start('camp-1').subscribe(), `${baseUrl}/camp-1/start`);
    check(() => service.pause('camp-1').subscribe(), `${baseUrl}/camp-1/pause`);
    check(() => service.resume('camp-1').subscribe(), `${baseUrl}/camp-1/resume`);
    check(() => service.stop('camp-1').subscribe(), `${baseUrl}/camp-1/stop`);
  });

  it('calls the global ops/run-jobs endpoint with no campaign id', () => {
    service.runJobsNow().subscribe();

    const req = http.expectOne(`${baseUrl}/ops/run-jobs`);
    expect(req.request.method).toBe('POST');
    req.flush({
      initialSends: { considered: 0, sent: 0, failed: 0, skipped: 0 },
      followUps: { considered: 0, sent: 0, failed: 0, skipped: 0 },
      retries: { considered: 0, sent: 0, failed: 0, skipped: 0 },
    });
  });
});

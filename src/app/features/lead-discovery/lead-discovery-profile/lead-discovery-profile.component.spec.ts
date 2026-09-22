import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { Campaign, CampaignStatus } from '../../../core/models/campaign.model';
import { LeadDiscoveryProfile } from '../../../core/models/lead-discovery.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { LeadDiscoveryProfileComponent } from './lead-discovery-profile.component';

const profile: LeadDiscoveryProfile = {
  isEnabled: true,
  targetBusinessType: 'Eye clinic',
  keywords: ['eye clinic', 'optometrist'],
  locations: ['Andheri West, Mumbai'],
  batchSize: 20,
  planMaxBatchSize: 25,
  requiredFields: ['city', 'Email'],
  phoneRequired: false,
  emailRequired: false,
  independentBusiness: true,
  minimumLeadScore: 70,
  additionalCriteria: ['Open on weekends'],
  autoCampaignEnabled: false,
  sourceCampaignId: null,
  sourceCampaignName: null,
  sourceCampaignStatus: null,
  updatedAt: '2026-09-15T10:00:00Z',
};

describe('LeadDiscoveryProfileComponent', () => {
  let fixture: ComponentFixture<LeadDiscoveryProfileComponent>;
  let component: LeadDiscoveryProfileComponent;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
  let campaigns: jasmine.SpyObj<CampaignService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(loaded: LeadDiscoveryProfile): void {
    service.getProfile.and.returnValue(of(loaded));
    fixture = TestBed.createComponent(LeadDiscoveryProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('LeadDiscoveryService', ['getProfile', 'saveProfile']);
    service.saveProfile.and.callFake((request) => of({ ...profile, ...request, updatedAt: '2026-09-15T11:00:00Z' }));
    campaigns = jasmine.createSpyObj('CampaignService', ['getPaged']);
    campaigns.getPaged.and.returnValue(of(emptyPage<Campaign>()));
    notify = jasmine.createSpyObj('NotificationService', ['success']);

    TestBed.configureTestingModule({
      declarations: [LeadDiscoveryProfileComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
        { provide: CampaignService, useValue: campaigns },
        { provide: NotificationService, useValue: notify },
      ],
    });
  });

  it('loads the profile, folding Phone/Email required fields into their switches', () => {
    create(profile);

    const v = component.form.getRawValue();
    expect(v.targetBusinessType).toBe('Eye clinic');
    expect(v.emailRequired).toBeTrue();
    expect(v.phoneRequired).toBeFalse();
    expect(v.fields.City).toBeTrue();
    expect(component.lists.locations).toEqual(['Andheri West, Mumbai']);
    expect(component.hasChanges).toBeFalse();
    expect(text()).toContain('Discovery is on');
    expect(text()).toContain('Your plan allows up to 25 per run.');
  });

  it('saves the whole profile without Phone/Email in requiredFields', () => {
    create(profile);

    component.form.controls.minimumLeadScore.setValue(80);
    component.form.markAsDirty();
    expect(component.hasChanges).toBeTrue();
    component.save();

    expect(service.saveProfile).toHaveBeenCalledWith({
      isEnabled: true,
      targetBusinessType: 'Eye clinic',
      keywords: ['eye clinic', 'optometrist'],
      locations: ['Andheri West, Mumbai'],
      batchSize: 20,
      requiredFields: ['City'],
      phoneRequired: false,
      emailRequired: true,
      independentBusiness: true,
      minimumLeadScore: 80,
      additionalCriteria: ['Open on weekends'],
      autoCampaignEnabled: false,
      sourceCampaignId: null,
    });
    expect(notify.success).toHaveBeenCalled();
    expect(component.hasChanges).toBeFalse();
  });

  it('does not save without keywords and locations', () => {
    create({ ...profile, keywords: [], locations: [] });

    component.save();
    fixture.detectChanges();

    expect(service.saveProfile).not.toHaveBeenCalled();
    expect(text()).toContain('Add at least one search keyword.');
    expect(text()).toContain('Add at least one location.');
  });

  it('caps the batch size at the plan limit', () => {
    create({ ...profile, batchSize: 50, planMaxBatchSize: 25 });

    expect(component.batchLimit).toBe(25);
    expect(component.form.controls.batchSize.hasError('max')).toBeTrue();
    component.save();
    expect(service.saveProfile).not.toHaveBeenCalled();
  });

  it('keeps a location with a comma as one entry and rejects duplicates', () => {
    create(profile);

    const chipInput = { clear: jasmine.createSpy('clear') };
    component.addLocation({ value: 'Sector 17, Chandigarh', chipInput } as never);
    component.addKeyword({ value: 'Optometrist, lens store', chipInput } as never);

    expect(component.lists.locations).toEqual(['Andheri West, Mumbai', 'Sector 17, Chandigarh']);
    expect(component.lists.keywords).toEqual(['eye clinic', 'optometrist', 'lens store']);
    expect(component.hasChanges).toBeTrue();
  });

  it('shows a default, never-saved profile as off', () => {
    create({
      ...profile,
      isEnabled: false,
      targetBusinessType: '',
      keywords: [],
      locations: [],
      requiredFields: [],
      additionalCriteria: [],
      planMaxBatchSize: null,
      updatedAt: null,
    });

    expect(text()).toContain('Discovery is off');
    expect(text()).toContain('Not saved yet.');
    expect(component.batchLimit).toBe(200);
  });

  describe('auto campaign', () => {
    const runningCampaign: Campaign = {
      id: 'campaign-1',
      name: 'Spring Outreach',
      description: null,
      status: CampaignStatus.Running,
      scheduledStartAt: null,
      createdBy: 'user-1',
      startedAt: '2026-09-01T09:00:00Z',
      stoppedAt: null,
      audienceCount: 5,
      steps: [],
      createdAt: '2026-08-30T09:00:00Z',
    };

    it('blocks saving when enabled with no source campaign selected', () => {
      create(profile);

      component.form.controls.autoCampaignEnabled.setValue(true);
      component.form.markAsDirty();
      fixture.detectChanges();
      expect(component.sourceCampaignMissing).toBeTrue();

      component.save();
      fixture.detectChanges();

      expect(service.saveProfile).not.toHaveBeenCalled();
      expect(text()).toContain('Select a source campaign to enable auto campaign.');
    });

    it('saves with the selected source campaign once one is picked', () => {
      campaigns.getPaged.and.returnValue(of({ items: [runningCampaign], totalCount: 1, page: 1, pageSize: 100, totalPages: 1 }));
      create(profile);
      fixture.detectChanges();

      component.form.controls.autoCampaignEnabled.setValue(true);
      component.form.controls.sourceCampaignId.setValue(runningCampaign.id);
      component.form.markAsDirty();
      expect(component.sourceCampaignMissing).toBeFalse();
      expect(component.sourceCampaignIneligible).toBeFalse();

      component.save();

      expect(service.saveProfile).toHaveBeenCalledWith(
        jasmine.objectContaining({ autoCampaignEnabled: true, sourceCampaignId: runningCampaign.id })
      );
    });

    it('flags a saved source campaign that is no longer eligible (Stopped)', () => {
      create({
        ...profile,
        autoCampaignEnabled: true,
        sourceCampaignId: 'campaign-stopped',
        sourceCampaignName: 'Old Campaign',
        sourceCampaignStatus: CampaignStatus.Stopped,
      });
      fixture.detectChanges();

      expect(component.sourceCampaignIneligible).toBeTrue();
      expect(text()).toContain("This campaign is Stopped and can no longer be used. Pick another.");

      component.save();
      expect(service.saveProfile).not.toHaveBeenCalled();
    });
  });
});

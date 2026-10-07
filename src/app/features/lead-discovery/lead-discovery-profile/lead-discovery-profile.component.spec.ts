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
import { TenantProfile } from '../../../core/models/tenant-profile.model';
import { TenantProfileService } from '../../../core/services/tenant-profile.service';
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
  autoConsentDiscoveredCustomers: false,
  autoCampaignStartMode: 'Immediate',
  autoCampaignStartTime: null,
  updatedAt: '2026-09-15T10:00:00Z',
};

describe('LeadDiscoveryProfileComponent', () => {
  let fixture: ComponentFixture<LeadDiscoveryProfileComponent>;
  let component: LeadDiscoveryProfileComponent;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
  let campaigns: jasmine.SpyObj<CampaignService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let tenantProfile: jasmine.SpyObj<TenantProfileService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(loaded: LeadDiscoveryProfile): void {
    service.getProfile.and.returnValue(of(loaded));
    fixture = TestBed.createComponent(LeadDiscoveryProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('LeadDiscoveryService', ['getProfile', 'saveProfile', 'suggestKeywords']);
    service.saveProfile.and.callFake((request) => of({ ...profile, ...request, updatedAt: '2026-09-15T11:00:00Z' }));
    campaigns = jasmine.createSpyObj('CampaignService', ['getPaged']);
    campaigns.getPaged.and.returnValue(of(emptyPage<Campaign>()));
    notify = jasmine.createSpyObj('NotificationService', ['success']);
    tenantProfile = jasmine.createSpyObj('TenantProfileService', ['getProfile']);
    tenantProfile.getProfile.and.returnValue(of({ companyName: 'CIS', countryCode: 'IN' } as TenantProfile));

    TestBed.configureTestingModule({
      declarations: [LeadDiscoveryProfileComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
        { provide: CampaignService, useValue: campaigns },
        { provide: NotificationService, useValue: notify },
        { provide: TenantProfileService, useValue: tenantProfile },
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
      description: null,
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
      autoConsentDiscoveredCustomers: false,
      autoCampaignStartMode: 'Immediate',
      autoCampaignStartTime: null,
    });
    expect(notify.success).toHaveBeenCalled();
    expect(component.hasChanges).toBeFalse();
  });

  it('warns when auto-consent is turned on, and sends it on save', () => {
    create(profile);
    expect(text()).not.toContain('Skips manual opt-in.');

    component.form.controls.autoConsentDiscoveredCustomers.setValue(true);
    component.form.markAsDirty();
    fixture.detectChanges();

    expect(text()).toContain('Skips manual opt-in.');

    component.save();

    expect(service.saveProfile).toHaveBeenCalledWith(jasmine.objectContaining({ autoConsentDiscoveredCustomers: true }));
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

    it('blocks saving a next-day start with no time picked', () => {
      campaigns.getPaged.and.returnValue(of({ items: [runningCampaign], totalCount: 1, page: 1, pageSize: 100, totalPages: 1 }));
      create(profile);
      fixture.detectChanges();

      component.form.controls.autoCampaignEnabled.setValue(true);
      component.form.controls.sourceCampaignId.setValue(runningCampaign.id);
      component.form.controls.autoCampaignStartMode.setValue('NextDayWithTime');
      component.form.markAsDirty();
      fixture.detectChanges();
      expect(component.startTimeMissing).toBeTrue();

      component.save();
      fixture.detectChanges();

      expect(service.saveProfile).not.toHaveBeenCalled();
      expect(text()).toContain('Pick a time for the next-day start.');
    });

    it('sends the next-day start time widened to HH:mm:ss', () => {
      campaigns.getPaged.and.returnValue(of({ items: [runningCampaign], totalCount: 1, page: 1, pageSize: 100, totalPages: 1 }));
      create(profile);
      fixture.detectChanges();

      component.form.controls.autoCampaignEnabled.setValue(true);
      component.form.controls.sourceCampaignId.setValue(runningCampaign.id);
      component.form.controls.autoCampaignStartMode.setValue('NextDayWithTime');
      component.form.controls.autoCampaignStartTime.setValue('09:30');
      component.form.markAsDirty();
      expect(component.startTimeMissing).toBeFalse();

      component.save();

      expect(service.saveProfile).toHaveBeenCalledWith(
        jasmine.objectContaining({ autoCampaignStartMode: 'NextDayWithTime', autoCampaignStartTime: '09:30:00' })
      );
    });

    it('narrows a loaded HH:mm:ss start time to the native time input value', () => {
      create({ ...profile, autoCampaignStartMode: 'NextDayWithTime', autoCampaignStartTime: '09:30:00' });

      expect(component.form.controls.autoCampaignStartTime.value).toBe('09:30');
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

  describe('AI suggest for the keywords', () => {
    const button = (): HTMLButtonElement =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.list-head .suggest-button')!;
    const chips = (): string[] =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.suggestion')).map((c) => c.textContent!.replace('add', '').trim());

    beforeEach(() => {
      service.suggestKeywords.and.returnValue(of({ keywords: ['optician', 'eyewear store', 'lasik centre'], source: 'AI' }));
    });

    it('has a description box and the button on the Search keywords heading, off until something is written', () => {
      create(profile);
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('textarea[formcontrolname="description"]')).toBeTruthy();
      const head = button().closest('.list-head')!;
      expect(head.querySelector('.list-label')!.textContent).toContain('Search keywords');
      expect(head.querySelector('.count')).toBeTruthy(); // beside the count, at the right of the heading
      expect(button().disabled).toBeTrue();

      component.form.controls.description.setValue('We sell practice software');
      fixture.detectChanges();
      expect(button().disabled).toBeFalse();
    });

    it('sends the description, the target type and the keywords already added', () => {
      create({ ...profile, description: 'We sell practice software to clinics.' });

      button().click();
      fixture.detectChanges();

      expect(service.suggestKeywords).toHaveBeenCalledOnceWith({
        description: 'We sell practice software to clinics.',
        targetBusinessType: 'Eye clinic',
        existing: ['eye clinic', 'optometrist'],
      });
    });

    it('shows what came back, says where from, and adds nothing by itself', () => {
      create({ ...profile, description: 'We sell practice software.' });

      button().click();
      fixture.detectChanges();

      expect(chips()).toEqual(['optician', 'eyewear store', 'lasik centre']);
      expect(text()).toContain('written by your AI assistant');
      expect(component.lists.keywords).toEqual(['eye clinic', 'optometrist']);
    });

    it('adds a picked suggestion, or all of them, as keywords and marks the form changed', () => {
      create({ ...profile, description: 'We sell practice software.' });
      button().click();
      fixture.detectChanges();

      component.addSuggestion('optician');
      expect(component.lists.keywords).toEqual(['eye clinic', 'optometrist', 'optician']);
      expect(component.suggestions).toEqual(['eyewear store', 'lasik centre']);

      component.addAllSuggestions();
      expect(component.lists.keywords).toEqual(['eye clinic', 'optometrist', 'optician', 'eyewear store', 'lasik centre']);
      expect(component.suggestions).toEqual([]);
    });

    it('says plainly when the suggestions were not written by AI', () => {
      service.suggestKeywords.and.returnValue(of({ keywords: ['eye clinic'], source: 'Common terms' }));
      create({ ...profile, description: 'x' });

      button().click();
      fixture.detectChanges();

      expect(text()).toContain('put together from your target business type');
      expect(text()).not.toContain('written by your AI assistant');
    });

    it('keeps the description with the profile when saved', () => {
      create({ ...profile, description: '  Practice software  ' });
      component.form.controls.description.setValue('  Practice software for clinics  ');
      component.form.markAsDirty();

      component.save();

      expect(service.saveProfile).toHaveBeenCalledWith(jasmine.objectContaining({ description: 'Practice software for clinics' }));
    });
  });

  describe('locations by country', () => {
    it('offers the cities of the country from the profile, grouped by state', () => {
      create(profile);

      expect(component.usesCityList).toBeTrue();
      expect(component.countryLabel).toBe('India');
      const states = component.filteredCityGroups.map((g) => g.name);
      expect(states).toContain('Punjab');
      expect(states).toContain('Maharashtra');
      const punjab = component.filteredCityGroups.find((g) => g.name === 'Punjab')!;
      expect(punjab.cities.map((c) => c.value)).toContain('Mohali, Punjab');
    });

    it('lets several cities be chosen at once and keeps them as the locations', () => {
      create(profile);

      component.onLocationsChosen(['Mohali, Punjab', 'Pune, Maharashtra', 'Chandigarh']);

      expect(component.lists.locations).toEqual(['Mohali, Punjab', 'Pune, Maharashtra', 'Chandigarh']);
      expect(component.hasChanges).toBeTrue();
      component.save();
      expect(service.saveProfile).toHaveBeenCalledWith(
        jasmine.objectContaining({ locations: ['Mohali, Punjab', 'Pune, Maharashtra', 'Chandigarh'] })
      );
    });

    it('keeps a location saved before the list existed, in its own group', () => {
      create(profile); // 'Andheri West, Mumbai' is not a catalog value

      expect(component.filteredCityGroups[0].name).toBe('Already saved');
      expect(component.filteredCityGroups[0].cities.map((c) => c.value)).toEqual(['Andheri West, Mumbai']);
      expect(component.locationSelect.value).toEqual(['Andheri West, Mumbai']);
    });

    it('narrows the list as the search is typed, by city or by state', () => {
      create(profile);

      component.citySearch.setValue('mohali');
      expect(component.filteredCityGroups.map((g) => g.name)).toEqual(['Punjab']);
      expect(component.filteredCityGroups[0].cities.map((c) => c.city)).toEqual(['Mohali']);

      component.citySearch.setValue('kerala');
      expect(component.filteredCityGroups.map((g) => g.name)).toEqual(['Kerala']);
      expect(component.filteredCityGroups[0].cities.length).toBeGreaterThan(5);
    });

    it('stops offering more once the limit is reached, but still lets a chosen one be unticked', () => {
      create(profile);
      const many = component.filteredCityGroups.flatMap((g) => g.cities.map((c) => c.value)).slice(0, 25);

      component.onLocationsChosen(many);

      expect(component.locationsAtLimit).toBeTrue();
      expect(component.isLocationSelected(many[0])).toBeTrue();
      component.remove('locations', many[0]);
      expect(component.locationsAtLimit).toBeFalse();
      expect(component.locationSelect.value.length).toBe(24);
    });

    it('drops the extra choices again when discarded', () => {
      create(profile);
      component.onLocationsChosen(['Mohali, Punjab']);

      component.discard();

      expect(component.lists.locations).toEqual(['Andheri West, Mumbai']);
      expect(component.locationSelect.value).toEqual(['Andheri West, Mumbai']);
    });

    it('falls back to typing locations when the profile has no country', () => {
      tenantProfile.getProfile.and.returnValue(of({ companyName: 'CIS', countryCode: null } as TenantProfile));
      create(profile);
      fixture.detectChanges();

      expect(component.usesCityList).toBeFalse();
      expect(text()).toContain('Choose your country on the Profile Information page');
      expect((fixture.nativeElement as HTMLElement).querySelector('mat-chip-grid[aria-label="Locations"]')).toBeTruthy();
    });
  });
});

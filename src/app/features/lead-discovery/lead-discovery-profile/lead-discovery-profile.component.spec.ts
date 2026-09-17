import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { LeadDiscoveryProfile } from '../../../core/models/lead-discovery.model';
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
  updatedAt: '2026-09-15T10:00:00Z',
};

describe('LeadDiscoveryProfileComponent', () => {
  let fixture: ComponentFixture<LeadDiscoveryProfileComponent>;
  let component: LeadDiscoveryProfileComponent;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
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
    notify = jasmine.createSpyObj('NotificationService', ['success']);

    TestBed.configureTestingModule({
      declarations: [LeadDiscoveryProfileComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
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
});

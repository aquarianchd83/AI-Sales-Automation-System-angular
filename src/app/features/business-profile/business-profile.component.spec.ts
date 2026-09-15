import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { TenantProfile } from '../../core/models/tenant-profile.model';
import { BillingService } from '../../core/services/billing.service';
import { NotificationService } from '../../core/services/notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { TimeZoneService } from '../../core/services/timezone.service';
import { SharedModule } from '../../shared/shared.module';
import { BusinessProfileComponent } from './business-profile.component';

const profile: TenantProfile = {
  companyName: 'SunVolt Energy',
  productName: 'SunVolt Home Solar',
  industry: 'Solar & energy',
  businessDescription: 'Rooftop solar for homes.',
  websiteUrl: 'https://sunvolt.example.com',
  supportEmail: null,
  supportPhone: null,
  domainKeywords: ['solar panels'],
  timezone: 'Asia/Kolkata',
  countryCode: 'IN',
};

describe('BusinessProfileComponent', () => {
  let fixture: ComponentFixture<BusinessProfileComponent>;
  let component: BusinessProfileComponent;
  let profileService: jasmine.SpyObj<TenantProfileService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    profileService = jasmine.createSpyObj('TenantProfileService', [
      'getProfile',
      'updateBusinessProfile',
      'updateTimezone',
      'updateCountry',
    ]);
    profileService.getProfile.and.returnValue(of(profile));
    profileService.updateBusinessProfile.and.callFake((request) => of({ ...profile, ...request }));
    profileService.updateTimezone.and.callFake((timezone) => of({ ...profile, timezone }));
    profileService.updateCountry.and.callFake((countryCode) => of({ ...profile, countryCode }));
    notify = jasmine.createSpyObj('NotificationService', ['success']);

    TestBed.configureTestingModule({
      declarations: [BusinessProfileComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: TenantProfileService, useValue: profileService },
        {
          provide: TimeZoneService,
          useValue: {
            getTimezones: () =>
              of([
                { id: 'Asia/Kolkata', displayName: 'India', utcOffset: '+05:30' },
                { id: 'Europe/London', displayName: 'London', utcOffset: '+00:00' },
              ]),
          },
        },
        {
          provide: BillingService,
          useValue: { getRegions: () => of([{ countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹' }]) },
        },
        { provide: NotificationService, useValue: notify },
      ],
    });

    fixture = TestBed.createComponent(BusinessProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the profile into the form and shows the summary', () => {
    expect(component.form.controls.companyName.value).toBe('SunVolt Energy');
    expect(component.form.controls.supportEmail.value).toBe('');
    expect(component.keywords).toEqual(['solar panels']);
    expect(component.hasChanges).toBeFalse();
    expect(text()).toContain('SE'); // avatar initials
    expect(text()).toContain('solar panels');
    expect(text()).toContain('6 of 8 details added');
    expect(text()).not.toContain('You have unsaved changes');
  });

  it('adds keywords from a pasted list, skipping blanks and case-insensitive duplicates', () => {
    component.addKeywords('Inverters,  SOLAR PANELS , ,net   metering');

    expect(component.keywords).toEqual(['solar panels', 'Inverters', 'net metering']);
    expect(component.keywordError).toBeNull();
    expect(component.hasChanges).toBeTrue();
    fixture.detectChanges();
    expect(text()).toContain('You have unsaved changes');
  });

  it('rejects over-long keywords and stops at the keyword limit', () => {
    component.addKeywords('x'.repeat(51));
    expect(component.keywordError).toContain('at most 50 characters');
    expect(component.keywords.length).toBe(1);

    component.addKeywords(Array.from({ length: 40 }, (_, i) => `k${i}`).join(','));
    expect(component.keywords.length).toBe(30);
    expect(component.keywordError).toContain('up to 30 keywords');
  });

  it('saves business fields with blanks as null, and calls the timezone endpoint only when it changed', () => {
    component.form.controls.productName.setValue('   ');
    component.form.controls.supportPhone.setValue('+91 98765 43210');
    component.form.controls.timezone.setValue('Europe/London');
    component.form.markAsDirty();
    component.addKeywords('Inverters');

    component.save();

    expect(profileService.updateBusinessProfile).toHaveBeenCalledOnceWith({
      companyName: 'SunVolt Energy',
      productName: null,
      industry: 'Solar & energy',
      businessDescription: 'Rooftop solar for homes.',
      websiteUrl: 'https://sunvolt.example.com',
      supportEmail: null,
      supportPhone: '+91 98765 43210',
      domainKeywords: ['solar panels', 'Inverters'],
    });
    expect(profileService.updateTimezone).toHaveBeenCalledOnceWith('Europe/London');
    expect(profileService.updateCountry).not.toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('Business profile saved.');
    expect(component.hasChanges).toBeFalse();
  });

  it('blocks saving while a field is invalid', () => {
    component.form.controls.websiteUrl.setValue('sunvolt dot com');
    component.form.controls.supportEmail.setValue('not-an-email');
    component.form.markAsDirty();

    component.save();

    expect(profileService.updateBusinessProfile).not.toHaveBeenCalled();
    expect(component.form.controls.websiteUrl.touched).toBeTrue();
  });

  it('discards unsaved edits back to the last saved profile', () => {
    component.form.controls.companyName.setValue('Something else');
    component.form.markAsDirty();
    component.addKeywords('temp');

    component.discard();

    expect(component.form.controls.companyName.value).toBe('SunVolt Energy');
    expect(component.keywords).toEqual(['solar panels']);
    expect(component.hasChanges).toBeFalse();
  });
});

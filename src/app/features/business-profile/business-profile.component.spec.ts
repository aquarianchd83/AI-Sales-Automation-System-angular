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
  supportEmail: 'hello@sunvolt.example.com',
  supportPhone: '+91 99999 00000',
  domainKeywords: ['solar panels'],
  timezone: 'Asia/Kolkata',
  countryCode: 'IN',
  targetAudience: 'Homeowners in Punjab',
  targetLocation: 'Chandigarh',
  targetCustomerType: 'consumers',
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
      'refineDescription',
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
          useValue: {
            getRegions: () => of([{ countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹' }]),
            getStates: () => of([{ code: 'MH', name: 'Maharashtra' }]),
          },
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
    expect(component.form.controls.supportEmail.value).toBe('hello@sunvolt.example.com');
    expect(component.hasChanges).toBeFalse();
    expect(text()).toContain('SE'); // avatar initials
    expect(text()).not.toContain('Domain keywords'); // no longer asked here; saved keywords are kept
    expect(text()).toContain('7 of 7 details added');
    expect(text()).not.toContain('You have unsaved changes');
  });

  it('has no audience section - that is asked on the Lead Discovery profile', () => {
    expect(text()).not.toContain('Target audience');
    expect(text()).not.toContain('Target location');
  });

  it('saves business fields with blanks as null, and calls the timezone endpoint only when it changed', () => {
    component.form.controls.productName.setValue('   ');
    component.form.controls.supportPhone.setValue('+91 98765 43210');
    component.form.controls.timezone.setValue('Europe/London');
    component.form.markAsDirty();

    component.save();

    expect(profileService.updateBusinessProfile).toHaveBeenCalledOnceWith({
      companyName: 'SunVolt Energy',
      productName: null,
      industry: 'Solar & energy',
      industrySubcategory: null,
      businessDescription: 'Rooftop solar for homes.',
      websiteUrl: 'https://sunvolt.example.com',
      supportEmail: 'hello@sunvolt.example.com',
      supportPhone: '+91 98765 43210',
      domainKeywords: ['solar panels'], // not asked here any more: what is stored is sent back unchanged
      workingHours: null,
      // Who to reach is gathered on the Lead Discovery profile; saving here leaves what is stored alone.
      targetAudience: 'Homeowners in Punjab',
      targetLocation: 'Chandigarh',
      targetCustomerType: 'consumers',
    });
    expect(profileService.updateTimezone).toHaveBeenCalledOnceWith('Europe/London');
    expect(profileService.updateCountry).not.toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('Business profile saved.');
    expect(component.hasChanges).toBeFalse();
  });

  it('requires what onboarding needs: industry, description, support email and phone, country', () => {
    for (const key of ['industry', 'businessDescription', 'supportEmail', 'supportPhone', 'countryCode'] as const) {
      component.form.controls[key].setValue('');
      expect(component.form.controls[key].hasError('required')).withContext(key).toBeTrue();
    }
    component.form.markAsDirty();

    component.save();

    expect(profileService.updateBusinessProfile).not.toHaveBeenCalled();
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

    component.discard();

    expect(component.form.controls.companyName.value).toBe('SunVolt Energy');
    expect(component.hasChanges).toBeFalse();
  });

  describe('sub-category', () => {
    it('is an optional box beside the industry, saved with the rest', () => {
      const label = (fixture.nativeElement as HTMLElement).textContent!;
      expect(label).toContain('Sub-category (optional)');

      component.form.controls.industry.setValue('Healthcare');
      component.form.controls.industrySubcategory.setValue('  Eye clinic ');
      component.form.markAsDirty();
      component.save();

      expect(profileService.updateBusinessProfile).toHaveBeenCalledWith(
        jasmine.objectContaining({ industry: 'Healthcare', industrySubcategory: 'Eye clinic' })
      );
    });

    it('is left empty without complaint', () => {
      expect(component.form.controls.industrySubcategory.valid).toBeTrue();
    });
  });
});

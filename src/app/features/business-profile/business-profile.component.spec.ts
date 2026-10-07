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
      'suggestKeywords',
      'refineDescription',
    ]);
    profileService.getProfile.and.returnValue(of(profile));
    profileService.updateBusinessProfile.and.callFake((request) => of({ ...profile, ...request }));
    profileService.updateTimezone.and.callFake((timezone) => of({ ...profile, timezone }));
    profileService.updateCountry.and.callFake((countryCode) => of({ ...profile, countryCode }));
    profileService.suggestKeywords.and.returnValue(of({ keywords: ['rooftop solar', 'net metering', 'inverters'], source: 'AI' }));
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
    expect(component.keywords).toEqual(['solar panels']);
    expect(component.hasChanges).toBeFalse();
    expect(text()).toContain('SE'); // avatar initials
    expect(text()).toContain('solar panels');
    expect(text()).toContain('8 of 8 details added');
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

  it('has no audience section - that is asked on the Lead Discovery profile', () => {
    expect(text()).not.toContain('Target audience');
    expect(text()).not.toContain('Target location');
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
      industrySubcategory: null,
      businessDescription: 'Rooftop solar for homes.',
      websiteUrl: 'https://sunvolt.example.com',
      supportEmail: 'hello@sunvolt.example.com',
      supportPhone: '+91 98765 43210',
      domainKeywords: ['solar panels', 'Inverters'],
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
    component.addKeywords('temp');

    component.discard();

    expect(component.form.controls.companyName.value).toBe('SunVolt Energy');
    expect(component.keywords).toEqual(['solar panels']);
    expect(component.hasChanges).toBeFalse();
  });

  describe('AI suggest', () => {
    const button = (): HTMLButtonElement =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.suggest-row:not(.description-suggest) button')).find((b) => b.textContent!.includes('AI suggest'))!;
    const chips = (): string[] =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.suggestion')).map((c) => c.textContent!.replace('add', '').trim());

    it('sits above the keyword box and is off until an industry is chosen', () => {
      const root = fixture.nativeElement as HTMLElement;
      const row = root.querySelector('.suggest-row:not(.description-suggest)')!;
      const box = root.querySelector('mat-chip-grid')!;
      expect(row.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      expect(button().disabled).toBeFalse(); // the fixture's industry is "Solar & energy"
      component.form.controls.industry.setValue('  ');
      fixture.detectChanges();
      expect(button().disabled).toBeTrue();
      expect(text()).toContain('Choose an industry to get suggestions.');
    });

    it('asks for the selected industry, with the description and the keywords already added', () => {
      component.addKeywords('Inverters');
      button().click();
      fixture.detectChanges();

      expect(profileService.suggestKeywords).toHaveBeenCalledOnceWith({
        industry: 'Solar & energy',
        industrySubcategory: null,
        businessDescription: 'Rooftop solar for homes.',
        existing: ['solar panels', 'Inverters'],
      });
    });

    it('shows what came back, says where it came from, and adds nothing by itself', () => {
      button().click();
      fixture.detectChanges();

      expect(chips()).toEqual(['rooftop solar', 'net metering', 'inverters']);
      expect(text()).toContain('Suggested for Solar & energy');
      expect(text()).toContain('written by your AI assistant');
      expect(component.keywords).toEqual(['solar panels']);
    });

    it('does not call common terms AI', () => {
      profileService.suggestKeywords.and.returnValue(of({ keywords: ['net metering'], source: 'Common terms' }));

      button().click();
      fixture.detectChanges();

      expect(text()).toContain('common terms for this industry');
      expect(text()).not.toContain('written by your AI assistant');
    });

    it('adds a clicked suggestion as a keyword and takes it off the list', () => {
      button().click();
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.suggestion')[1].click();
      fixture.detectChanges();

      expect(component.keywords).toEqual(['solar panels', 'net metering']);
      expect(chips()).toEqual(['rooftop solar', 'inverters']);
      expect(component.hasChanges).toBeTrue();
    });

    it('adds them all at once, skipping one that is already there in another case', () => {
      component.addKeywords('Rooftop Solar');
      button().click();
      fixture.detectChanges();

      component.addAllSuggestions();
      fixture.detectChanges();

      expect(component.keywords).toEqual(['solar panels', 'Rooftop Solar', 'net metering', 'inverters']);
      expect(component.suggestions).toEqual([]);
    });

    it('can be dismissed, and says so when there is nothing to suggest', () => {
      button().click();
      fixture.detectChanges();
      component.dismissSuggestions();
      fixture.detectChanges();
      expect(chips()).toEqual([]);

      profileService.suggestKeywords.and.returnValue(of({ keywords: [], source: 'Common terms' }));
      button().click();
      fixture.detectChanges();
      expect(text()).toContain('Nothing to suggest for "Solar & energy" yet');
    });
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

    it('goes to the keyword suggestions, so they are for the speciality and not the whole industry', () => {
      component.form.controls.industrySubcategory.setValue('Eye clinic');
      const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.suggest-row:not(.description-suggest) button'))
        .find((b) => b.textContent!.includes('AI suggest'))!;
      button.click();

      expect(profileService.suggestKeywords).toHaveBeenCalledWith(jasmine.objectContaining({ industrySubcategory: 'Eye clinic' }));
    });
  });

  describe('AI suggest for the description', () => {
    const button = (): HTMLButtonElement =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.description-suggest button')!;

    beforeEach(() => {
      profileService.refineDescription.and.returnValue(of({ description: 'We install rooftop solar for homes across Punjab.', source: 'AI' }));
    });

    it('is off until there is a draft to refine', () => {
      component.form.controls.businessDescription.setValue('   ');
      fixture.detectChanges();

      expect(button().disabled).toBeTrue();
    });

    it('sends the draft with the industry and sub-category, and shows the proposal without touching the text', () => {
      component.form.controls.industrySubcategory.setValue('Rooftop solar');
      button().click();
      fixture.detectChanges();

      expect(profileService.refineDescription).toHaveBeenCalledOnceWith({
        description: 'Rooftop solar for homes.',
        industry: 'Solar & energy',
        industrySubcategory: 'Rooftop solar',
      });
      expect(text()).toContain('We install rooftop solar for homes across Punjab.');
      expect(text()).toContain('written by your AI assistant');
      expect(component.form.controls.businessDescription.value).toBe('Rooftop solar for homes.');
    });

    it('replaces the description only when the proposal is used, and marks the form changed', () => {
      button().click();
      fixture.detectChanges();

      component.useDescriptionProposal();
      fixture.detectChanges();

      expect(component.form.controls.businessDescription.value).toBe('We install rooftop solar for homes across Punjab.');
      expect(component.hasChanges).toBeTrue();
      expect(component.descriptionProposal).toBeNull();
    });

    it('goes away without a change when dismissed', () => {
      button().click();
      fixture.detectChanges();

      component.dismissDescriptionProposal();

      expect(component.descriptionProposal).toBeNull();
      expect(component.form.controls.businessDescription.value).toBe('Rooftop solar for homes.');
    });

    it('says plainly when the text was only tidied rather than written by AI', () => {
      profileService.refineDescription.and.returnValue(of({ description: 'Rooftop solar for homes.', source: 'Tidied' }));

      button().click();
      fixture.detectChanges();

      expect(text()).toContain('your text, tidied up');
      expect(text()).not.toContain('written by your AI assistant');
    });
  });
});

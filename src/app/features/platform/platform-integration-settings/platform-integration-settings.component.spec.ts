import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { IntegrationChannel, PlatformIntegrationSettings } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformIntegrationSettingsService } from '../../../core/services/platform-integration-settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformIntegrationSettingsComponent } from './platform-integration-settings.component';

const channel = (over: Partial<IntegrationChannel> = {}): IntegrationChannel => ({
  mode: 'Simulator',
  apiUrl: '',
  apiKeyHeader: 'Authorization',
  senderId: '',
  timeoutSeconds: 15,
  hasApiKey: false,
  apiKeyHint: null,
  isLive: false,
  ...over,
});

const stored = (over: Partial<PlatformIntegrationSettings> = {}): PlatformIntegrationSettings => ({
  consentSms: channel(),
  dndCheck: channel(),
  ...over,
});

describe('PlatformIntegrationSettingsComponent', () => {
  let service: jasmine.SpyObj<PlatformIntegrationSettingsService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const create = (settings: PlatformIntegrationSettings) => {
    service = jasmine.createSpyObj('PlatformIntegrationSettingsService', ['get', 'save', 'testConsentSms', 'testDndCheck']);
    service.get.and.returnValue(of(settings));
    service.save.and.callFake(() => of(settings));
    service.testConsentSms.and.returnValue(of({ success: true, message: 'accepted' }));
    service.testDndCheck.and.returnValue(of({ success: true, message: 'passes' }));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [PlatformIntegrationSettingsComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformIntegrationSettingsService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(PlatformIntegrationSettingsComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  it('starts on the simulator for both services and shows no API fields', () => {
    const { fixture, component } = create(stored());

    expect(component.isApi('consentSms')).toBeFalse();
    expect(component.isApi('dndCheck')).toBeFalse();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Consent SMS');
    expect(text).toContain('DND check');
    expect(text).toContain('nothing leaves the platform');
    expect((fixture.nativeElement as HTMLElement).querySelector('input[formcontrolname="apiUrl"]')).toBeNull();
  });

  it('shows the API fields for a service switched to the third-party API, and the key only as a hint', () => {
    const { fixture, component } = create(
      stored({ consentSms: channel({ mode: 'Api', apiUrl: 'https://sms.example.com/send', hasApiKey: true, apiKeyHint: '••••1234', isLive: true }) })
    );

    expect(component.isApi('consentSms')).toBeTrue();
    expect(component.isApi('dndCheck')).toBeFalse();
    expect(component.form.controls.consentSms.controls.apiKey.value).toBe('');
    expect(component.storedHint('consentSms')).toBe('••••1234');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input[formcontrolname="apiUrl"]').length).toBe(1);
  });

  it('saves a blank key as null (keep) and a removed key as an empty string (clear)', () => {
    const { component } = create(stored({ consentSms: channel({ mode: 'Api', apiUrl: 'https://sms.example.com/send', hasApiKey: true, apiKeyHint: '••••1234', isLive: true }) }));

    component.form.controls.consentSms.controls.senderId.setValue('SALESX');
    component.form.controls.consentSms.controls.senderId.markAsDirty();
    component.save();
    expect(service.save.calls.mostRecent().args[0].consentSms.apiKey).toBeNull();
    expect(service.save.calls.mostRecent().args[0].consentSms.senderId).toBe('SALESX');

    component.form.controls.consentSms.controls.removeApiKey.setValue(true);
    component.form.controls.consentSms.controls.removeApiKey.markAsDirty();
    component.save();
    expect(service.save.calls.mostRecent().args[0].consentSms.apiKey).toBe('');
    expect(notify.success).toHaveBeenCalled();
  });

  it('refuses to save an address that is not https', () => {
    const { component } = create(stored());

    component.form.controls.dndCheck.controls.mode.setValue('Api');
    component.form.controls.dndCheck.controls.apiUrl.setValue('http://dnd.example.com');
    component.form.markAsDirty();
    component.save();

    expect(service.save).not.toHaveBeenCalled();
  });

  it('tests each service with what is on screen and shows the outcome until the form changes', () => {
    const { component } = create(stored({ dndCheck: channel({ mode: 'Api', apiUrl: 'https://dnd.example.com/check', hasApiKey: true, apiKeyHint: '••••5678', isLive: true }) }));

    component.testTo.dndCheck.setValue('+919876543210');
    component.test('dndCheck');

    const request = service.testDndCheck.calls.mostRecent().args[0];
    expect(request.to).toBe('+919876543210');
    expect(request.settings.mode).toBe('Api');
    expect(request.settings.apiKey).toBeNull();
    expect(component.results.dndCheck?.message).toBe('passes');

    component.form.controls.dndCheck.controls.timeoutSeconds.setValue(30);
    expect(component.results.dndCheck).toBeNull();
  });

  it('does not test without a valid number', () => {
    const { component } = create(stored());

    component.testTo.consentSms.setValue('9876543210');
    component.test('consentSms');

    expect(service.testConsentSms).not.toHaveBeenCalled();
  });
});

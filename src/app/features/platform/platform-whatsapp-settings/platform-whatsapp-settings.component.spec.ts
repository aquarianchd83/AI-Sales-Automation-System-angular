import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PlatformWhatsAppSettings } from '../../../core/models/platform-whatsapp.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppSettingsService } from '../../../core/services/platform-whatsapp-settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformWhatsAppSettingsComponent } from './platform-whatsapp-settings.component';

const stored = (over: Partial<PlatformWhatsAppSettings> = {}): PlatformWhatsAppSettings => ({
  enabled: true,
  phoneNumberId: '123456789012345',
  whatsAppBusinessAccountId: '987654321098765',
  hasAccessToken: true,
  accessTokenHint: '••••9876',
  apiVersion: 'v19.0',
  apiBaseUrl: 'https://graph.facebook.com/',
  isConfigured: true,
  canManageTemplates: true,
  ...over,
});

describe('PlatformWhatsAppSettingsComponent', () => {
  let service: jasmine.SpyObj<PlatformWhatsAppSettingsService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const create = (settings: PlatformWhatsAppSettings) => {
    service = jasmine.createSpyObj('PlatformWhatsAppSettingsService', ['get', 'save', 'test']);
    service.get.and.returnValue(of(settings));
    service.save.and.callFake(() => of(settings));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [PlatformWhatsAppSettingsComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformWhatsAppSettingsService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(PlatformWhatsAppSettingsComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  };

  it('loads what is stored and shows the token only as a hint', () => {
    const { component, text } = create(stored());

    expect(component.form.controls.phoneNumberId.value).toBe('123456789012345');
    expect(component.form.controls.accessToken.value).toBe('');
    expect(component.storedTokenHint).toBe('••••9876');
    expect(text()).toContain('Tenant notices can be sent on WhatsApp');
  });

  it('says plainly when no number is set up, and when it is switched off', () => {
    expect(create(stored({ isConfigured: false, hasAccessToken: false, phoneNumberId: '', canManageTemplates: false })).text()).toContain(
      'No platform WhatsApp number is set up'
    );

    TestBed.resetTestingModule();
    expect(create(stored({ isConfigured: false, enabled: false, canManageTemplates: false })).text()).toContain('switched off');
  });

  it('asks for the business account id when templates cannot be managed yet', () => {
    expect(create(stored({ canManageTemplates: false, whatsAppBusinessAccountId: '' })).text()).toContain('Add the WhatsApp Business Account id');
  });

  it('keeps the stored token when its field is left blank, and clears it on request', () => {
    const { component } = create(stored());
    component.form.controls.phoneNumberId.setValue('555555555555');
    component.form.markAsDirty();

    component.save();
    expect(service.save.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ phoneNumberId: '555555555555', accessToken: null }));

    component.form.patchValue({ removeAccessToken: true, enabled: false });
    component.form.markAsDirty();
    component.save();
    expect(service.save.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ accessToken: '', enabled: false }));
  });

  it('sends a new token as typed', () => {
    const { component } = create(stored());
    component.form.patchValue({ accessToken: ' EAAB-new ' });
    component.form.markAsDirty();

    component.save();

    expect(service.save.calls.mostRecent().args[0].accessToken).toBe('EAAB-new');
  });

  it('will not save a number that cannot work', () => {
    const { component } = create(stored());
    component.form.patchValue({ phoneNumberId: '+919876543210' });
    component.form.markAsDirty();
    component.save();
    expect(service.save).not.toHaveBeenCalled();

    // Switched on with nothing behind it.
    component.form.patchValue({ phoneNumberId: '', enabled: true });
    component.save();
    expect(service.save).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('tests only the saved number, to a number with a country code', () => {
    const { fixture, component, text } = create(stored());
    service.test.and.returnValue(of({ success: true, message: "Sent Meta's sample message to +919876543210." }));

    component.testTo.setValue('98765 43210');
    component.sendTest();
    expect(service.test).not.toHaveBeenCalled();

    component.testTo.setValue('+919876543210');
    component.form.markAsDirty();
    component.sendTest();
    expect(service.test).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();

    component.form.markAsPristine();
    component.sendTest();
    fixture.detectChanges();
    expect(service.test.calls.mostRecent().args[0]).toBe('+919876543210');
    expect(text()).toContain("Sent Meta's sample message");
  });
});

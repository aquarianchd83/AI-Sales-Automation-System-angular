import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { WhatsAppBridgeSettings, WhatsAppProviderSettings } from '../../../core/models/platform-whatsapp-provider.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppBridgeService } from '../../../core/services/platform-whatsapp-bridge.service';
import { PlatformWhatsAppProviderService } from '../../../core/services/platform-whatsapp-provider.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformWhatsAppProviderComponent } from './platform-whatsapp-provider.component';

const settings = (active = 'Meta', bridgeAvailable = false): WhatsAppProviderSettings => ({
  active,
  providers: [
    { id: 'Meta', name: 'Meta WhatsApp Cloud API', available: true, unavailableReason: null },
    {
      id: 'QrBridge',
      name: 'QR-Code WhatsApp Bridge',
      available: bridgeAvailable,
      unavailableReason: bridgeAvailable ? null : 'Save the bridge address and API key in the bridge settings first.',
    },
  ],
});

const bridgeSettings = (over: Partial<WhatsAppBridgeSettings> = {}): WhatsAppBridgeSettings => ({
  baseUrl: '',
  hasApiKey: false,
  apiKeyHint: null,
  webhookBaseUrl: '',
  pilotTenantIds: [],
  isConfigured: false,
  ...over,
});

const PILOT = '11111111-2222-3333-4444-555555555555';

describe('PlatformWhatsAppProviderComponent', () => {
  let service: jasmine.SpyObj<PlatformWhatsAppProviderService>;
  let bridge: jasmine.SpyObj<PlatformWhatsAppBridgeService>;
  let notify: jasmine.SpyObj<NotificationService>;

  function create() {
    const fixture = TestBed.createComponent(PlatformWhatsAppProviderComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('PlatformWhatsAppProviderService', ['get', 'save']);
    bridge = jasmine.createSpyObj('PlatformWhatsAppBridgeService', ['getSettings', 'saveSettings']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    service.get.and.returnValue(of(settings()));
    bridge.getSettings.and.returnValue(of(bridgeSettings()));
    TestBed.configureTestingModule({
      declarations: [PlatformWhatsAppProviderComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformWhatsAppProviderService, useValue: service },
        { provide: PlatformWhatsAppBridgeService, useValue: bridge },
        { provide: NotificationService, useValue: notify },
      ],
    });
  });

  it('shows the active provider and starts with nothing to save', () => {
    const fixture = create();

    expect(fixture.nativeElement.textContent).toContain('Meta WhatsApp Cloud API');
    expect(fixture.componentInstance.pristine).toBeTrue();
  });

  it('lists the bridge but disables it, with its reason, until it is configured', () => {
    const fixture = create();
    const radios = fixture.nativeElement.querySelectorAll('mat-radio-button');

    expect(radios.length).toBe(2);
    expect(radios[1].querySelector('input').disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Save the bridge address and API key');
  });

  it('enables the bridge option once the server says it is available', () => {
    service.get.and.returnValue(of(settings('Meta', true)));
    const fixture = create();

    expect(fixture.nativeElement.querySelectorAll('mat-radio-button')[1].querySelector('input').disabled).toBeFalse();
  });

  it('puts the selection back to the active provider and shows the reason when the server refuses the save', () => {
    service.get.and.returnValue(of(settings('Meta', true)));
    const fixture = create();
    const component = fixture.componentInstance;
    service.save.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { Provider: ['The bridge is not reachable with the saved settings: down'] } } }))
    );

    component.selected = 'QrBridge';
    component.save();

    expect(service.save).toHaveBeenCalledWith('QrBridge');
    expect(component.selected).toBe('Meta');
    expect(notify.error).toHaveBeenCalledWith('The bridge is not reachable with the saved settings: down');
  });

  it('does not call the server when nothing changed', () => {
    const fixture = create();

    fixture.componentInstance.save();

    expect(service.save).not.toHaveBeenCalled();
  });

  describe('bridge settings', () => {
    it('never shows the stored key, only that one exists', () => {
      bridge.getSettings.and.returnValue(of(bridgeSettings({ baseUrl: 'http://b', hasApiKey: true, apiKeyHint: '••••3456', isConfigured: true })));
      const fixture = create();

      expect(fixture.componentInstance.bridgeForm.getRawValue().apiKey).toBe('');
      expect(fixture.nativeElement.textContent).toContain('••••3456');
    });

    it('keeps the stored key by sending null when the key box is blank, and parses the pilot ids', () => {
      const fixture = create();
      const component = fixture.componentInstance;
      bridge.saveSettings.and.returnValue(of(bridgeSettings({ baseUrl: 'http://b', pilotTenantIds: [PILOT], isConfigured: true })));

      component.bridgeForm.patchValue({ baseUrl: 'http://b', webhookBaseUrl: 'https://api', pilotTenantIds: ` ${PILOT}\n` });
      component.saveBridge();

      expect(bridge.saveSettings).toHaveBeenCalledWith({
        baseUrl: 'http://b',
        apiKey: null,
        webhookBaseUrl: 'https://api',
        pilotTenantIds: [PILOT],
      });
      // The provider list is reloaded so the bridge becomes selectable.
      expect(service.get).toHaveBeenCalledTimes(2);
    });

    it('refuses a pilot entry that is not a tenant id, without calling the server', () => {
      const fixture = create();
      const component = fixture.componentInstance;

      component.bridgeForm.patchValue({ pilotTenantIds: 'not-an-id' });
      component.saveBridge();

      expect(component.pilotIds).toBeNull();
      expect(bridge.saveSettings).not.toHaveBeenCalled();
    });

    it('shows the server reason and keeps what was typed when the bridge is rejected', () => {
      const fixture = create();
      const component = fixture.componentInstance;
      bridge.saveSettings.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { BaseUrl: ['The bridge did not accept these settings: The bridge rejected the API key.'] } } }))
      );

      component.bridgeForm.patchValue({ baseUrl: 'http://b', apiKey: 'wrong' });
      component.saveBridge();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="bridge-error"]').textContent).toContain('rejected the API key');
      expect(component.bridgeForm.getRawValue().apiKey).toBe('wrong');
    });
  });
});

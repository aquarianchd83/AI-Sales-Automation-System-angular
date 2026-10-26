import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { WhatsAppProviderSettings } from '../../../core/models/platform-whatsapp-provider.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppProviderService } from '../../../core/services/platform-whatsapp-provider.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformWhatsAppProviderComponent } from './platform-whatsapp-provider.component';

const settings = (active = 'Meta'): WhatsAppProviderSettings => ({
  active,
  providers: [
    { id: 'Meta', name: 'Meta WhatsApp Cloud API', available: true, unavailableReason: null },
    { id: 'QrBridge', name: 'QR-Code WhatsApp Bridge', available: false, unavailableReason: 'Not built yet.' },
  ],
});

describe('PlatformWhatsAppProviderComponent', () => {
  let service: jasmine.SpyObj<PlatformWhatsAppProviderService>;
  let notify: jasmine.SpyObj<NotificationService>;

  function create() {
    const fixture = TestBed.createComponent(PlatformWhatsAppProviderComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('PlatformWhatsAppProviderService', ['get', 'save']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    service.get.and.returnValue(of(settings()));
    TestBed.configureTestingModule({
      declarations: [PlatformWhatsAppProviderComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformWhatsAppProviderService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });
  });

  it('shows the active provider and starts with nothing to save', () => {
    const fixture = create();

    expect(fixture.nativeElement.textContent).toContain('Meta WhatsApp Cloud API');
    expect(fixture.componentInstance.pristine).toBeTrue();
  });

  it('lists the unavailable bridge but disables it, with its reason', () => {
    const fixture = create();
    const radios = fixture.nativeElement.querySelectorAll('mat-radio-button');

    expect(radios.length).toBe(2);
    expect(radios[1].querySelector('input').disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Not built yet.');
  });

  it('puts the selection back to the active provider when the server refuses the save', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    service.save.and.returnValue(throwError(() => new Error('400')));

    component.selected = 'QrBridge';
    component.save();

    expect(service.save).toHaveBeenCalledWith('QrBridge');
    expect(component.selected).toBe('Meta');
    expect(notify.error).toHaveBeenCalled();
  });

  it('does not call the server when nothing changed', () => {
    const fixture = create();

    fixture.componentInstance.save();

    expect(service.save).not.toHaveBeenCalled();
  });
});

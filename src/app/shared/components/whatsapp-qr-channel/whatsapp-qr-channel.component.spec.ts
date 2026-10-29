import { fakeAsync, TestBed, tick, discardPeriodicTasks } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { WhatsAppChannelStatus } from '../../../core/models/platform-whatsapp-provider.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppBridgeService } from '../../../core/services/platform-whatsapp-bridge.service';
import { SharedModule } from '../../../shared/shared.module';
import { WhatsAppQrChannelComponent } from './whatsapp-qr-channel.component';

const channel = (over: Partial<WhatsAppChannelStatus> = {}): WhatsAppChannelStatus => ({
  status: 'NotConnected',
  connectedPhone: null,
  lastError: null,
  statusUpdatedAtUtc: null,
  qrBase64: null,
  qrRefreshSeconds: null,
  confirmed: true,
  bridgeReachable: true,
  ...over,
});

const QR = 'data:image/png;base64,QR1';

describe('WhatsAppQrChannelComponent', () => {
  let bridge: jasmine.SpyObj<PlatformWhatsAppBridgeService>;
  let notify: jasmine.SpyObj<NotificationService>;

  function create() {
    const fixture = TestBed.createComponent(WhatsAppQrChannelComponent);
    fixture.componentInstance.tenantId = 't1';
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.textContent ?? '';

  beforeEach(() => {
    bridge = jasmine.createSpyObj('PlatformWhatsAppBridgeService', ['getStatus', 'connect', 'disconnect', 'remove']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    bridge.getStatus.and.returnValue(of(channel()));
    TestBed.configureTestingModule({
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformWhatsAppBridgeService, useValue: bridge },
        { provide: NotificationService, useValue: notify },
      ],
    });
  });

  it('starts as not connected, offering to connect', fakeAsync(() => {
    const fixture = create();

    expect(text(fixture)).toContain('Not connected');
    expect(text(fixture)).toContain('Connect with QR code');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    discardPeriodicTasks();
  }));

  it('shows the QR in place after connecting, but is NOT connected until the bridge says so', fakeAsync(() => {
    bridge.connect.and.returnValue(of(channel({ status: 'QrCodeAvailable', qrBase64: QR, qrRefreshSeconds: 45 })));
    const fixture = create();

    fixture.componentInstance.connect();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(QR);
    expect(fixture.nativeElement.querySelector('[data-testid="qr-status"]').textContent).toContain('Scan the QR code');
    expect(fixture.componentInstance.connected).toBeFalse();
    discardPeriodicTasks();
  }));

  it('turns Connected and drops the QR only when a status poll reports Connected', fakeAsync(() => {
    bridge.connect.and.returnValue(of(channel({ status: 'QrCodeAvailable', qrBase64: QR })));
    const fixture = create();
    fixture.componentInstance.connect();
    fixture.detectChanges();

    bridge.getStatus.and.returnValue(of(channel({ status: 'Connected', connectedPhone: '919800000009' })));
    tick(3000);
    fixture.detectChanges();

    expect(fixture.componentInstance.connected).toBeTrue();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(text(fixture)).toContain('+919800000009');
    discardPeriodicTasks();
  }));

  it('keeps the QR on screen while a status poll reports it is still waiting', fakeAsync(() => {
    bridge.connect.and.returnValue(of(channel({ status: 'QrCodeAvailable', qrBase64: QR })));
    const fixture = create();
    fixture.componentInstance.connect();

    bridge.getStatus.and.returnValue(of(channel({ status: 'AwaitingAuthentication' })));
    tick(3000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(QR);
    discardPeriodicTasks();
  }));

  it('asks for a fresh QR while still pairing, before the old one expires', fakeAsync(() => {
    bridge.connect.and.returnValue(of(channel({ status: 'QrCodeAvailable', qrBase64: QR })));
    bridge.getStatus.and.returnValue(of(channel({ status: 'QrCodeAvailable' })));
    const fixture = create();
    fixture.componentInstance.connect();
    bridge.connect.calls.reset();

    tick(40000);

    expect(bridge.connect).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));

  it('says so when a disconnect could not be confirmed, and keeps the status', fakeAsync(() => {
    bridge.getStatus.and.returnValue(of(channel({ status: 'Connected' })));
    bridge.disconnect.and.returnValue(of(channel({ status: 'Connected', confirmed: false, lastError: 'The bridge still reports this session as open.' })));
    const fixture = create();

    fixture.componentInstance.disconnect();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="qr-unconfirmed"]')).not.toBeNull();
    expect(notify.success).not.toHaveBeenCalled();
    expect(fixture.componentInstance.connected).toBeTrue();
    discardPeriodicTasks();
  }));

  it('asks before removing, then removes', fakeAsync(() => {
    bridge.getStatus.and.returnValue(of(channel({ status: 'Disconnected' })));
    bridge.remove.and.returnValue(of(channel()));
    const fixture = create();

    fixture.componentInstance.askRemove();
    fixture.detectChanges();
    expect(bridge.remove).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('Confirm remove');

    fixture.componentInstance.remove();

    expect(bridge.remove).toHaveBeenCalledWith('t1');
    expect(notify.success).toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  it('does not claim Connected when the bridge cannot be reached, and recovers on its own', fakeAsync(() => {
    bridge.getStatus.and.returnValues(
      of(channel({ status: 'Connected', connectedPhone: '919800000009', bridgeReachable: false, lastError: 'The bridge could not be reached.' })),
      of(channel({ status: 'Connected', connectedPhone: '919800000009' }))
    );
    const fixture = create();

    expect(fixture.nativeElement.querySelector('[data-testid="qr-status"]').textContent).toContain("Can't verify right now");
    expect(fixture.componentInstance.connected).toBeFalse();
    expect(fixture.nativeElement.querySelector('[data-testid="qr-unverified"]')).not.toBeNull();
    expect(text(fixture)).not.toContain('Connect with QR code');

    tick(3000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="qr-status"]').textContent).toContain('Connected');
    expect(fixture.nativeElement.querySelector('[data-testid="qr-unverified"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="qr-error"]')).toBeNull();
    discardPeriodicTasks();
  }));

  it('clears an old request error once the bridge answers a status read', fakeAsync(() => {
    const fixture = create();
    fixture.componentInstance.error = 'The bridge could not be reached.';

    fixture.componentInstance.refresh(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.error).toBeNull();
    discardPeriodicTasks();
  }));
});

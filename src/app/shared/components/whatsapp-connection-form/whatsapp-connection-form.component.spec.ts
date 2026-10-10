import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { TenantWhatsAppConfig, UpdateTenantWhatsAppConfigRequest } from '../../../core/models/tenant-settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../shared.module';
import { WhatsAppConnectionFormComponent } from './whatsapp-connection-form.component';

const saved: TenantWhatsAppConfig = {
  phoneNumberId: '1098765',
  whatsAppBusinessAccountId: '2233445',
  hasAccessToken: true,
  hasAppSecret: true,
  apiVersion: 'v19.0',
  apiBaseUrl: 'https://graph.facebook.com/',
  isConnected: true,
  hasWebhookVerifyToken: false,
  appId: null,
  verifiedAtUtc: null,
  verificationError: null,
};

describe('WhatsAppConnectionFormComponent', () => {
  let fixture: ComponentFixture<WhatsAppConnectionFormComponent>;
  let component: WhatsAppConnectionFormComponent;
  let save: jasmine.Spy<(r: UpdateTenantWhatsAppConfigRequest) => ReturnType<WhatsAppConnectionFormComponent['save']>>;
  let verify: jasmine.Spy;
  let notify: jasmine.SpyObj<NotificationService>;

  const el = (): HTMLElement => fixture.nativeElement;
  const button = (label: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.includes(label))!;

  function create(config: TenantWhatsAppConfig | null): void {
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      imports: [SharedModule, NoopAnimationsModule],
      providers: [{ provide: NotificationService, useValue: notify }],
    });
    fixture = TestBed.createComponent(WhatsAppConnectionFormComponent);
    component = fixture.componentInstance;
    save = jasmine.createSpy('save').and.callFake(() => of({ ...saved }));
    verify = jasmine.createSpy('verify');
    component.save = save;
    component.verify = verify;
    component.config = config;
    component.ngOnChanges({ config: { currentValue: config, previousValue: undefined, firstChange: true, isFirstChange: () => true } });
    fixture.detectChanges();
  }

  it('says when nothing is connected yet, and cannot verify', () => {
    create(null);

    expect(el().querySelector('.status')!.textContent).toContain('Not connected');
    expect(button('Verify connection').disabled).toBeTrue();
  });

  it('asks for the secrets on a first save and sends only what was typed', () => {
    create(null);
    component.form.patchValue({ phoneNumberId: ' 1098765 ', whatsAppBusinessAccountId: '2233445', accessToken: 'EAAG', appSecret: 's3cret' });

    component.onSave();

    expect(save).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      phoneNumberId: '1098765', whatsAppBusinessAccountId: '2233445', accessToken: 'EAAG', appSecret: 's3cret',
    }));
    expect(notify.success).toHaveBeenCalledWith('WhatsApp connection saved. Now verify it.');
  });

  it('refuses a first save without the token', () => {
    create(null);
    component.form.patchValue({ phoneNumberId: '1', whatsAppBusinessAccountId: '2' });

    component.onSave();

    expect(save).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Enter the access token.');
  });

  it('says so when a required field is empty instead of silently doing nothing', () => {
    create(null);
    component.form.patchValue({ phoneNumberId: '', whatsAppBusinessAccountId: '', accessToken: 'tok', appSecret: 'sec' });

    component.onSave();

    expect(save).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Fill in the Phone number ID and the WhatsApp Business Account ID before saving.');
  });

  it('keeps stored secrets when their fields are left blank', () => {
    create(saved);
    component.form.patchValue({ phoneNumberId: '1098766' });
    component.form.markAsDirty();

    component.onSave();

    const request = save.calls.mostRecent().args[0];
    expect(request.accessToken).toBeUndefined();
    expect(request.appSecret).toBeUndefined();
  });

  it('AC09: verifies the saved connection and shows the number Meta confirmed', () => {
    create(saved);
    verify.and.returnValue(of({ ...saved, verifiedAtUtc: '2026-10-06T08:00:00Z', verifiedDisplayPhoneNumber: '+91 98765 43210', verifiedName: 'Confianza IT' }));
    let emitted: TenantWhatsAppConfig | undefined;
    component.changed.subscribe((c) => (emitted = c));

    button('Verify connection').click();
    fixture.detectChanges();

    expect(component.state).toBe('verified');
    expect(el().querySelector('.status')!.textContent).toContain('+91 98765 43210');
    expect(emitted?.verifiedAtUtc).toBeTruthy();
    expect(notify.success).toHaveBeenCalledWith('WhatsApp is connected.');
  });

  it("shows Meta's reason when verification fails", () => {
    create(saved);
    verify.and.returnValue(of({ ...saved, verificationError: 'Invalid OAuth access token. (code 190)' }));

    component.onVerify();
    fixture.detectChanges();

    expect(component.state).toBe('failed');
    expect(el().querySelector('.status')!.textContent).toContain('code 190');
    expect(notify.error).toHaveBeenCalledWith('Invalid OAuth access token. (code 190)');
  });

  it('will not verify unsaved edits', () => {
    create(saved);
    component.form.controls.phoneNumberId.setValue('999');
    component.form.markAsDirty();
    fixture.detectChanges();

    expect(component.canVerify).toBeFalse();
    expect(button('Verify connection').disabled).toBeTrue();
  });
});

import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { DeliveryTestResult, PlatformDeliverySettings } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformDeliverySettingsService } from '../../../core/services/platform-delivery-settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformDeliverySettingsComponent } from './platform-delivery-settings.component';

const stored = (over: Partial<PlatformDeliverySettings> = {}): PlatformDeliverySettings => ({
  publicUrl: 'https://app.example.com',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: 'mailer',
  smtpFrom: 'no-reply@example.com',
  smtpEnableSsl: true,
  hasSmtpPassword: true,
  smtpPasswordHint: '••••1234',
  isEmailConfigured: true,
  smsEnabled: true,
  smsOtpTemplateId: 'tpl-1',
  smsBaseUrl: 'https://control.msg91.com/api/v5/',
  hasSmsAuthKey: true,
  smsAuthKeyHint: '••••9876',
  isSmsConfigured: true,
  ...over,
});

describe('PlatformDeliverySettingsComponent', () => {
  let service: jasmine.SpyObj<PlatformDeliverySettingsService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const create = (settings: PlatformDeliverySettings) => {
    service = jasmine.createSpyObj('PlatformDeliverySettingsService', ['get', 'save', 'testEmail', 'testSms']);
    service.get.and.returnValue(of(settings));
    service.save.and.callFake(() => of(settings));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [PlatformDeliverySettingsComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformDeliverySettingsService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(PlatformDeliverySettingsComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  it('loads what is stored and shows secrets only as hints', () => {
    const { fixture, component } = create(stored());

    expect(component.form.controls.smtpHost.value).toBe('smtp.example.com');
    expect(component.form.controls.smtpPassword.value).toBe('');
    expect(component.storedHint('smtpPassword')).toBe('••••1234');
    expect(component.storedHint('smsAuthKey')).toBe('••••9876');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Password-reset and verification emails can be sent');
  });

  it('warns when emails cannot be sent', () => {
    const { fixture } = create(stored({ isEmailConfigured: false, smtpHost: '', smtpFrom: '' }));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No SMTP server is set up');
  });

  it('warns when the web app address is missing', () => {
    const { fixture } = create(stored({ publicUrl: '' }));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Set the web app address');
  });

  it('keeps stored secrets when their fields are left blank, and clears them on request', () => {
    const { component } = create(stored());
    component.form.controls.smtpHost.setValue('smtp2.example.com');
    component.form.markAsDirty();

    component.save();
    expect(service.save.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ smtpHost: 'smtp2.example.com', smtpPassword: null, smsAuthKey: null }));

    component.form.patchValue({ removeSmtpPassword: true, removeSmsAuthKey: true });
    component.form.markAsDirty();
    component.save();
    expect(service.save.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ smtpPassword: '', smsAuthKey: '' }));
  });

  it('sends a new secret as typed', () => {
    const { component } = create(stored());
    component.form.patchValue({ smtpPassword: ' new-pass ', smsAuthKey: ' new-key ' });
    component.form.markAsDirty();

    component.save();

    expect(service.save.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ smtpPassword: 'new-pass', smsAuthKey: 'new-key' }));
  });

  it('does not save anything invalid', () => {
    const { component } = create(stored());
    component.form.patchValue({ publicUrl: 'not a url', smtpPort: 0 });
    component.form.markAsDirty();

    component.save();

    expect(service.save).not.toHaveBeenCalled();
  });

  it('tests email with what is on screen and shows the outcome', () => {
    const { fixture, component } = create(stored());
    const result: DeliveryTestResult = { success: true, message: 'Test email sent to me@example.com.' };
    service.testEmail.and.returnValue(of(result));
    component.form.controls.smtpHost.setValue('other.example.com');
    component.testEmailTo.setValue('me@example.com');

    component.sendTestEmail();
    fixture.detectChanges();

    const sent = service.testEmail.calls.mostRecent().args[0];
    expect(sent.to).toBe('me@example.com');
    expect(sent.settings.smtpHost).toBe('other.example.com');
    expect(sent.settings.smtpPassword).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Test email sent to me@example.com.');
  });

  it('will not test email without an address, or without a host', () => {
    const { component } = create(stored({ smtpHost: '' }));

    component.sendTestEmail();
    component.testEmailTo.setValue('me@example.com');
    component.sendTestEmail();

    expect(service.testEmail).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('tests SMS to a number with a country code only', () => {
    const { component } = create(stored());
    service.testSms.and.returnValue(of({ success: true, message: 'sent' }));

    component.testSmsTo.setValue('98765 43210');
    component.sendTestSms();
    expect(service.testSms).not.toHaveBeenCalled();

    component.testSmsTo.setValue('+919876543210');
    component.sendTestSms();
    expect(service.testSms.calls.mostRecent().args[0].to).toBe('+919876543210');
  });

  it('forgets a test outcome as soon as the form changes', () => {
    const { component } = create(stored());
    component.emailResult = { success: true, message: 'sent' };

    component.form.controls.smtpHost.setValue('changed.example.com');

    expect(component.emailResult).toBeNull();
  });
});

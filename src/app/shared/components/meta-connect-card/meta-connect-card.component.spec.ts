import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { CompleteMetaSignupRequest, MetaIssue, MetaSignupClientConfig, MetaSignupResult } from '../../../core/models/meta-signup.model';
import { TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { MetaSignupService } from '../../../core/services/meta-signup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../shared.module';
import { MetaConnectCardComponent } from './meta-connect-card.component';

const enabled: MetaSignupClientConfig = { enabled: true, appId: '123', configurationId: '456', apiVersion: 'v21.0', issue: null };

const connected: TenantWhatsAppConfig = {
  phoneNumberId: '1',
  whatsAppBusinessAccountId: '2',
  hasAccessToken: true,
  hasAppSecret: true,
  apiVersion: 'v21.0',
  apiBaseUrl: 'https://graph.facebook.com/',
  isConnected: true,
  hasWebhookVerifyToken: false,
  appId: '123',
  verifiedAtUtc: '2026-10-09T10:00:00Z',
  verifiedDisplayPhoneNumber: '+91 98765 43210',
  verifiedName: 'Acme',
};

const cancel: CompleteMetaSignupRequest = {
  code: null, wabaId: null, phoneNumberId: null, clientEvent: 'CANCEL', clientStep: null, clientErrorMessage: null,
};

function issue(partial: Partial<MetaIssue>): MetaIssue {
  return {
    code: 'x', step: 'authorization', title: 'Title', message: 'Message', primaryAction: 'Reconnect',
    secondaryAction: null, retryable: false, reference: null, ...partial,
  };
}

describe('MetaConnectCardComponent', () => {
  let fixture: ComponentFixture<MetaConnectCardComponent>;
  let service: jasmine.SpyObj<MetaSignupService>;

  const el = (): HTMLElement => fixture.nativeElement;
  const button = (label: string): HTMLElement | undefined =>
    Array.from(el().querySelectorAll<HTMLElement>('button, a')).find((b) => b.textContent!.includes(label));

  function create(config: TenantWhatsAppConfig | null, clientConfig = enabled): void {
    service.getConfig.and.returnValue(of(clientConfig));
    fixture = TestBed.createComponent(MetaConnectCardComponent);
    fixture.componentInstance.config = config;
    fixture.componentInstance.phoneNumber = '+91 98765 43210';
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('MetaSignupService', ['getConfig', 'getStatus', 'complete', 'resume', 'launch']);
    TestBed.configureTestingModule({
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: MetaSignupService, useValue: service },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    });
  });

  it('offers Connect with Meta and names the number to pick', () => {
    create(null);

    expect(button('Connect with Meta')!.hasAttribute('disabled')).toBeFalse();
    expect(el().textContent).toContain('+91 98765 43210');
    expect(service.getStatus).not.toHaveBeenCalled();
  });

  it('explains, without a button to nowhere, when the platform has not set Meta up', () => {
    create(null, { ...enabled, enabled: false, issue: issue({ title: 'Connect with Meta is not available yet', primaryAction: 'ContactSupport' }) });

    expect(button('Connect with Meta')!.hasAttribute('disabled')).toBeTrue();
    expect(el().textContent).toContain('not available yet');
    expect(el().textContent).toContain('contact platform support');
  });

  it('shows a cancelled sign-in as an instruction to reconnect, with nothing raw from Meta', async () => {
    create(null);
    const result: MetaSignupResult = {
      status: 'ActionRequired',
      steps: [{ key: 'authorization', title: 'Meta authorization', status: 'ActionRequired', detail: 'Sign-in with Meta was not finished.' }],
      issue: issue({ title: 'Meta sign-in was not completed', message: 'Please reconnect your account and grant the required permissions.' }),
      config: null,
      templates: null,
    };
    service.launch.and.returnValue(Promise.resolve(cancel));
    service.complete.and.returnValue(of(result));

    button('Connect with Meta')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.complete).toHaveBeenCalledWith(cancel);
    expect(el().querySelector('[role=alert]')!.textContent).toContain('Meta sign-in was not completed');
    expect(el().textContent).toContain('Action required');
    expect(button('Reconnect with Meta')).toBeTruthy();
  });

  it('retries from the saved state, without a new Meta sign-in', () => {
    service.getStatus.and.returnValue(of({
      status: 'Failed',
      steps: [{ key: 'webhook', title: 'Message notifications', status: 'Failed', detail: null }],
      issue: issue({ code: 'meta_temporary', primaryAction: 'Retry', retryable: true, title: 'Meta is temporarily unavailable' }),
      config: connected,
      templates: null,
    }));
    service.resume.and.returnValue(of({
      status: 'Completed',
      steps: [{ key: 'webhook', title: 'Message notifications', status: 'Completed', detail: null }],
      issue: null,
      config: connected,
      templates: { total: 3, approved: 2, pending: 1, rejected: 0 },
    }));
    create(connected);

    button('Retry')!.click();
    fixture.detectChanges();

    expect(service.resume).toHaveBeenCalled();
    expect(service.launch).not.toHaveBeenCalled();
    expect(el().textContent).toContain('WhatsApp is active');
    expect(el().textContent).toContain('2 approved, 1 awaiting Meta');
  });

  it('is not active until Meta has confirmed everything', () => {
    service.getStatus.and.returnValue(of({
      status: 'ActionRequired',
      steps: [{ key: 'registration', title: 'Number registration', status: 'ActionRequired', detail: 'The number is not registered for messaging yet.' }],
      issue: null,
      config: connected,
      templates: null,
    }));
    create(connected);

    expect(el().textContent).not.toContain('WhatsApp is active');
    expect(el().textContent).toContain('Action required');
  });
});

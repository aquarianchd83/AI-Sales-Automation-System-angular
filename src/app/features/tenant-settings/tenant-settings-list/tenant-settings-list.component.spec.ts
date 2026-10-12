import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, of, throwError } from 'rxjs';

import { TenantCharges, TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';
import { MetaSignupService } from '../../../core/services/meta-signup.service';
import { EMBEDDED_IN_ONBOARDING } from '../../../core/tokens/embedded-in-onboarding';
import { SharedModule } from '../../../shared/shared.module';
import { TenantSettingsListComponent } from './tenant-settings-list.component';

const charges: TenantCharges = {
  currencyCode: 'USD',
  currencySymbol: '$',
  periodStartUtc: '2026-09-01T00:00:00Z',
  whatsApp: {
    messagesSent: 120,
    billableMessages: 30,
    freeMessages: 90,
    estimatedCostUsd: 0.402,
    estimatedCostLocal: 0.402,
    byCategory: [
      { category: 'Marketing', messages: 20, ratePerMessageUsd: 0.015, estimatedCostUsd: 0.3, estimatedCostLocal: 0.3 },
      { category: 'Utility', messages: 10, ratePerMessageUsd: 0.0102, estimatedCostUsd: 0.102, estimatedCostLocal: 0.102 },
    ],
  },
  leadDiscovery: { runs: 3, leadsSaved: 41, estimatedCostUsd: 1.25, estimatedCostLocal: 1.25 },
  totalEstimatedCostUsd: 1.652,
  totalEstimatedCostLocal: 1.652,
};

describe('TenantSettingsListComponent', () => {
  let fixture: ComponentFixture<TenantSettingsListComponent>;
  let service: jasmine.SpyObj<TenantSettingsService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(): void {
    fixture = TestBed.createComponent(TenantSettingsListComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('TenantSettingsService', [
      'getWhatsAppConfig', 'getUsage', 'getCharges', 'getWhatsAppNumber', 'setWhatsAppConnectionMode',
    ]);
    service.getWhatsAppConfig.and.returnValue(of(null));
    service.getUsage.and.returnValue(of({ messagesSentThisMonth: 120, maxMessagesPerMonth: 1000 }));
    service.getCharges.and.returnValue(of(charges));

    TestBed.configureTestingModule({
      declarations: [TenantSettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: TenantSettingsService, useValue: service },
        {
          provide: MetaSignupService,
          useValue: jasmine.createSpyObj('MetaSignupService', {
            getConfig: of({ enabled: true, appId: '1', configurationId: '2', apiVersion: 'v21.0', issue: null }),
            getStatus: NEVER,
          }),
        },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    });
  });

  it('shows WhatsApp and lead discovery charges with a total', () => {
    create();

    expect(text()).toContain('30 billable of 120 messages');
    expect(text()).toContain('$0.40');
    expect(text()).toContain('Marketing · 20');
    expect(text()).toContain('3 runs ·');
    expect(text()).toContain('41 leads');
    expect(text()).toContain('$1.25');
    expect(text()).toContain('$1.65');
    expect(text()).toContain('your provider invoices are the authority');
  });

  it('keeps four decimals below a unit, so a fraction of a cent is not shown as zero', () => {
    service.getCharges.and.returnValue(
      of({
        ...charges,
        whatsApp: { ...charges.whatsApp, estimatedCostLocal: 0.0072, byCategory: [] },
        leadDiscovery: { ...charges.leadDiscovery, runs: 0, leadsSaved: 0, estimatedCostLocal: 0 },
        totalEstimatedCostLocal: 0.0072,
      })
    );
    create();

    expect(text()).toContain('$0.0072');
    expect(text()).toContain('Replies inside an open conversation are free.');
  });

  it('says so when charges cannot be loaded, without breaking the rest of the page', () => {
    service.getCharges.and.returnValue(throwError(() => new Error('boom')));
    create();

    expect(text()).toContain("We couldn't load your charges right now.");
    expect(text()).toContain('Usage this month');
  });

  describe('connection mode', () => {
    const connected: TenantWhatsAppConfig = {
      phoneNumberId: '1098765',
      whatsAppBusinessAccountId: '2233445',
      hasAccessToken: true,
      hasAppSecret: true,
      apiVersion: 'v19.0',
      apiBaseUrl: 'https://graph.facebook.com/',
      isConnected: true,
      hasWebhookVerifyToken: false,
      appId: null,
      connectionMode: null,
    };

    const root = () => fixture.nativeElement as HTMLElement;
    const toggles = () => Array.from(root().querySelectorAll<HTMLElement>('mat-button-toggle'));
    const checkedModes = () => toggles().filter((t) => t.classList.contains('mat-button-toggle-checked')).map((t) => t.textContent?.trim());
    const click = (label: string) => {
      toggles().find((t) => t.textContent?.includes(label))!.querySelector('button')!.click();
      fixture.detectChanges();
    };
    const metaCardHidden = () => root().querySelector('.meta-card')!.classList.contains('mode-hidden');
    const manualHidden = () => root().querySelector('.manual-panel')!.classList.contains('mode-hidden');

    it('starts on Automatic when nothing was chosen, with exactly one option selected and the manual side hidden', () => {
      create();

      expect(checkedModes().length).toBe(1);
      expect(checkedModes()[0]).toContain('Automatic Connection');
      expect(metaCardHidden()).toBeFalse();
      expect(manualHidden()).toBeTrue();
    });

    it('shows the saved mode when the page opens', () => {
      service.getWhatsAppConfig.and.returnValue(of({ ...connected, connectionMode: 'Manual' }));
      create();

      expect(checkedModes()).toEqual([jasmine.stringMatching('Manual Connection') as unknown as string]);
      expect(metaCardHidden()).toBeTrue();
      expect(manualHidden()).toBeFalse();
    });

    it('treats a connection saved before modes existed as Automatic and does not write anything', () => {
      service.getWhatsAppConfig.and.returnValue(of({ ...connected, connectionMode: null }));
      create();

      expect(checkedModes()[0]).toContain('Automatic Connection');
      expect(service.setWhatsAppConnectionMode).not.toHaveBeenCalled();
    });

    it('selecting one mode deselects the other, in both directions, and saves each', () => {
      service.getWhatsAppConfig.and.returnValue(of({ ...connected, connectionMode: 'Automatic' }));
      service.setWhatsAppConnectionMode.and.callFake((mode) => of({ ...connected, connectionMode: mode }));
      create();

      click('Manual Connection');
      expect(service.setWhatsAppConnectionMode).toHaveBeenCalledOnceWith('Manual');
      expect(checkedModes().length).toBe(1);
      expect(checkedModes()[0]).toContain('Manual Connection');
      expect(manualHidden()).toBeFalse();
      expect(metaCardHidden()).toBeTrue();

      click('Automatic Connection');
      expect(service.setWhatsAppConnectionMode).toHaveBeenCalledWith('Automatic');
      expect(checkedModes().length).toBe(1);
      expect(checkedModes()[0]).toContain('Automatic Connection');
      expect(metaCardHidden()).toBeFalse();
      expect(manualHidden()).toBeTrue();
    });

    it('does not claim a mode that failed to save: the previous one stays selected and nothing is announced', () => {
      service.getWhatsAppConfig.and.returnValue(of({ ...connected, connectionMode: 'Automatic' }));
      service.setWhatsAppConnectionMode.and.returnValue(throwError(() => new Error('boom')));
      create();
      const notify = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;

      click('Manual Connection');

      expect(checkedModes()).toEqual([jasmine.stringMatching('Automatic Connection') as unknown as string]);
      expect(metaCardHidden()).toBeFalse();
      expect(manualHidden()).toBeTrue();
      expect(notify.success).not.toHaveBeenCalled();
    });

    it('with nothing connected yet it only chooses the side to show - there is no record to write', () => {
      create();

      click('Manual Connection');

      expect(service.setWhatsAppConnectionMode).not.toHaveBeenCalled();
      expect(checkedModes()[0]).toContain('Manual Connection');
      expect(manualHidden()).toBeFalse();
    });

    it('sends Manual with the connection when the manual form saves it', () => {
      create();

      const form = root().querySelector('app-whatsapp-connection-form');
      expect(form).toBeTruthy();
      expect(fixture.debugElement.query((d) => d.name === 'app-whatsapp-connection-form').componentInstance.connectionMode).toBe('Manual');
    });
  });

  describe('the WhatsApp number', () => {
    it('is never typed here - Meta asks for it, so there is no number field or save button', () => {
      create();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('.number-card')).toBeNull();
      expect(root.querySelector('input[type=tel]')).toBeNull();
      expect(text()).not.toContain('Save number');
      expect(service.getWhatsAppNumber).not.toHaveBeenCalled();
      expect(root.querySelector('app-meta-connect-card')).toBeTruthy();
    });
  });

  describe('inside onboarding', () => {
    beforeEach(() => {
      TestBed.overrideProvider(EMBEDDED_IN_ONBOARDING, { useValue: true });
      TestBed.configureTestingModule({ providers: [{ provide: EMBEDDED_IN_ONBOARDING, useValue: true }] });
    });

    it('shows only Connect with Meta - no manual credentials, usage, charges or job links', () => {
      create();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('app-meta-connect-card')).toBeTruthy();
      expect(root.textContent).toContain('Connect with Meta');
      expect(root.querySelector('app-whatsapp-connection-form')).toBeNull();
      expect(root.querySelector('mat-button-toggle-group')).toBeNull(); // no mode choice here: Connect with Meta only
      expect(root.querySelector('.meta-card')!.classList.contains('mode-hidden')).toBeFalse();
      expect(root.textContent).not.toContain('Charges this month');
      expect(root.textContent).not.toContain('Manage job schedules');
      expect(root.querySelector('app-page-header')).toBeNull();
    });

    it('does not fetch what it is not showing', () => {
      create();

      expect(service.getWhatsAppConfig).toHaveBeenCalled(); // Connect with Meta needs the saved connection
      expect(service.getUsage).not.toHaveBeenCalled();
      expect(service.getCharges).not.toHaveBeenCalled();
    });
  });
});

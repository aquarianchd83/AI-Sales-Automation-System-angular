import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformMessageTemplate, PlatformTemplateSyncResult, PlatformWhatsAppSettings } from '../../../core/models/platform-whatsapp.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformMessageTemplatesService } from '../../../core/services/platform-message-templates.service';
import { PlatformWhatsAppSettingsService } from '../../../core/services/platform-whatsapp-settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformMessageTemplatesComponent } from './platform-message-templates.component';

const template = (over: Partial<PlatformMessageTemplate> = {}): PlatformMessageTemplate => ({
  id: 't1',
  eventKey: 'PlanExpiring7',
  name: 'Plan expiring in 7 days',
  language: 'en',
  category: 'Utility',
  whatsAppTemplateName: 'tenant_alert_plan_expiring_7',
  status: 'Pending',
  bodyText: 'Hi {{TenantName}}, your plan ends soon. {{Message}} Open the Billing page to take care of it.',
  defaultBodyText: 'Hi {{TenantName}}, your plan ends soon. {{Message}} Open the Billing page to take care of it.',
  sampleMessage: 'Your Growth plan ends on 10 Oct 2026.',
  isActive: true,
  metaTemplateId: null,
  headerMediaAssetId: null,
  headerOnMeta: false,
  headerFileName: null,
  headerUrl: null,
  headerPreviewUrl: null,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: null,
  ...over,
});

const settings = (over: Partial<PlatformWhatsAppSettings> = {}): PlatformWhatsAppSettings => ({
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

describe('PlatformMessageTemplatesComponent', () => {
  let api: jasmine.SpyObj<PlatformMessageTemplatesService>;
  let wa: jasmine.SpyObj<PlatformWhatsAppSettingsService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let notify: jasmine.SpyObj<NotificationService>;

  const create = (templates: PlatformMessageTemplate[], s: PlatformWhatsAppSettings = settings()) => {
    api = jasmine.createSpyObj('PlatformMessageTemplatesService', ['getAll', 'update', 'restoreDefault', 'sync', 'syncOne', 'test']);
    api.getAll.and.returnValue(of(templates));
    wa = jasmine.createSpyObj('PlatformWhatsAppSettingsService', ['get']);
    wa.get.and.returnValue(of(s));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [PlatformMessageTemplatesComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformMessageTemplatesService, useValue: api },
        { provide: PlatformWhatsAppSettingsService, useValue: wa },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(PlatformMessageTemplatesComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  };

  it('shows each notice with its wording filled with sample values and what Meta said', () => {
    const { text } = create([
      template(),
      template({ id: 't2', name: 'Quota used up', whatsAppTemplateName: 'tenant_alert_quota_exhausted', status: 'Approved', metaTemplateId: 'm2' }),
    ]);

    expect(text()).toContain('Plan expiring in 7 days');
    expect(text()).toContain('Hi Acme Traders, your plan ends soon. Your Growth plan ends on 10 Oct 2026.');
    expect(text()).toContain('Not sent to Meta yet');
    expect(text()).toContain('Live');
    expect(text()).toContain('1 of 2 notices go out on WhatsApp right now.');
  });

  it('labels a template in review and one that is switched off', () => {
    const { component, text } = create([template({ metaTemplateId: 'm1' }), template({ id: 't2', isActive: false, status: 'Approved', metaTemplateId: 'm2' })]);

    expect(component.statusLabel(component.templates[0])).toBe('In review at Meta');
    expect(component.isLive(component.templates[1])).toBeFalse();
    expect(text()).toContain('Switched off');
  });

  it('warns, and will not sync, when the platform number is not set up', () => {
    const { fixture, component, text } = create([template()], settings({ isConfigured: false, canManageTemplates: false }));

    expect(text()).toContain('The platform WhatsApp number is not set up.');
    expect(component.canManageTemplates).toBeFalse();
    const sync = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('app-page-header button');
    expect(sync?.disabled).toBeTrue();
  });

  it('syncs with Meta and reports what happened, reloading the statuses', () => {
    const { fixture, component, text } = create([template()]);
    const result: PlatformTemplateSyncResult = { configured: true, note: null, created: 12, updated: 0, failures: ['tenant_alert_x: Meta said no.'], remoteCount: 12, statusUpdated: 1 };
    api.sync.and.returnValue(of(result));

    component.syncAll();
    fixture.detectChanges();

    expect(api.getAll).toHaveBeenCalledTimes(2);
    expect(text()).toContain('12 sent to Meta, 0 updated, 1 review result changed.');
    expect(text()).toContain('tenant_alert_x: Meta said no.');
  });

  it('explains an unconfigured sync instead of claiming success', () => {
    const { fixture, component, text } = create([template()]);
    api.sync.and.returnValue(of({ configured: false, note: 'The platform WhatsApp number is not set up.', created: 0, updated: 0, failures: [], remoteCount: 0, statusUpdated: 0 }));

    component.syncAll();
    fixture.detectChanges();

    expect(api.getAll).toHaveBeenCalledTimes(1);
    expect(text()).toContain('The platform WhatsApp number is not set up.');
  });

  it('switches a notice off without touching its wording or image', () => {
    const { component } = create([template()]);
    api.update.and.returnValue(of(template({ isActive: false })));

    component.toggleActive(component.templates[0], false);

    expect(api.update).toHaveBeenCalledWith('t1', jasmine.objectContaining({ isActive: false, headerMediaAssetId: null, removeHeaderImage: false }));
    expect(component.templates[0].isActive).toBeFalse();
  });

  it('syncs one template and shows its new status', () => {
    const { component } = create([template()]);
    api.syncOne.and.returnValue(of(template({ status: 'Approved', metaTemplateId: 'm1' })));

    component.syncOne(component.templates[0]);

    expect(component.templates[0].status).toBe('Approved');
    expect(notify.success).toHaveBeenCalledWith('Plan expiring in 7 days: Approved.');
  });

  it('restores the default text only after confirmation', () => {
    const { component } = create([template({ status: 'Approved', metaTemplateId: 'm1' })]);
    api.restoreDefault.and.returnValue(of(template({ status: 'Pending', metaTemplateId: 'm1' })));

    dialog.open.and.returnValue({ afterClosed: () => of(false) } as never);
    component.restoreDefault(component.templates[0]);
    expect(api.restoreDefault).not.toHaveBeenCalled();

    dialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
    component.restoreDefault(component.templates[0]);
    expect(api.restoreDefault).toHaveBeenCalledWith('t1');
    expect(component.templates[0].status).toBe('Pending');
  });

  it('tells the admin when an edit sends an approved template back to review', () => {
    const { component } = create([template({ status: 'Approved', metaTemplateId: 'm1' })]);
    dialog.open.and.returnValue({ afterClosed: () => of(template({ status: 'Pending', metaTemplateId: 'm1', bodyText: 'Hi {{TenantName}}, new words. {{Message}} Bye.' })) } as never);

    component.edit(component.templates[0]);

    expect(component.templates[0].bodyText).toContain('new words');
    expect(notify.success).toHaveBeenCalledWith(jasmine.stringMatching(/Meta has to review/));
  });
});

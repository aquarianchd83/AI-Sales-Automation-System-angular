import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { PlatformMessageTemplate } from '../../../core/models/platform-whatsapp.model';
import { PlatformMessageTemplatesService } from '../../../core/services/platform-message-templates.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTemplateTestDialogComponent } from './platform-template-test-dialog.component';

const template: PlatformMessageTemplate = {
  id: 't1',
  eventKey: 'QuotaExhausted',
  name: 'Quota used up',
  language: 'en',
  category: 'Utility',
  whatsAppTemplateName: 'tenant_alert_quota_exhausted',
  status: 'Approved',
  bodyText: 'Hi {{TenantName}}, you used it all. {{Message}} Buy more from Billing.',
  defaultBodyText: '',
  sampleMessage: 'Your balance is now 0.',
  isActive: true,
  metaTemplateId: 'm1',
  headerMediaAssetId: null,
  headerOnMeta: false,
  headerFileName: null,
  headerUrl: null,
  headerPreviewUrl: null,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: null,
};

describe('PlatformTemplateTestDialogComponent', () => {
  let api: jasmine.SpyObj<PlatformMessageTemplatesService>;

  const create = () => {
    api = jasmine.createSpyObj('PlatformMessageTemplatesService', ['test']);
    TestBed.configureTestingModule({
      declarations: [PlatformTemplateTestDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformMessageTemplatesService, useValue: api },
        { provide: MatDialogRef, useValue: jasmine.createSpyObj('MatDialogRef', ['close']) },
        { provide: MAT_DIALOG_DATA, useValue: template },
      ],
    });
    const fixture = TestBed.createComponent(PlatformTemplateTestDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  };

  it('shows what will be sent', () => {
    expect(create().text()).toContain('Hi Acme Traders, you used it all. Your balance is now 0. Buy more from Billing.');
  });

  it('sends only to a number with a country code, and shows the outcome', () => {
    const { fixture, component, text } = create();
    api.test.and.returnValue(of({ success: true, message: 'Sent to +919876543210.' }));

    component.to.setValue('98765 43210');
    component.send();
    expect(api.test).not.toHaveBeenCalled();

    component.to.setValue(' +919876543210 ');
    component.send();
    fixture.detectChanges();

    expect(api.test).toHaveBeenCalledWith('t1', '+919876543210');
    expect(text()).toContain('Sent to +919876543210.');
  });
});

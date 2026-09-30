import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { CampaignStepDialogComponent, CampaignStepDialogData } from './campaign-step-dialog.component';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';

const template = {
  id: 't1',
  name: 'initial_message',
  language: 'en',
  category: 'Marketing',
  whatsAppTemplateName: 'initial_message',
  whatsAppTemplateStatus: 'Approved',
  bodyText: 'Hi {{FirstName}}, welcome aboard!',
  isActive: true,
  createdAt: '2026-09-01T00:00:00Z',
  metaTemplateId: 'm1',
};

describe('CampaignStepDialogComponent', () => {
  let fixture: ComponentFixture<CampaignStepDialogComponent>;
  let http: HttpTestingController;
  const close = jasmine.createSpy('close');

  beforeEach(async () => {
    close.calls.reset();
    await TestBed.configureTestingModule({
      declarations: [CampaignStepDialogComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { campaignId: 'camp-1', existingSteps: [] } as CampaignStepDialogData },
        { provide: MatDialogRef, useValue: { close } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CampaignStepDialogComponent);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === `${environment.apiBaseUrl}/message-templates`)
      .flush({ items: [template], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('no longer asks for message text', () => {
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Message text');
    expect((fixture.componentInstance.form.controls as Record<string, unknown>)['messageText']).toBeUndefined();
  });

  it('previews the selected template as the text customers receive', () => {
    expect(fixture.nativeElement.querySelector('.template-preview')).toBeNull();

    fixture.componentInstance.form.controls.messageTemplateId.setValue('t1');
    fixture.detectChanges();

    const preview: HTMLElement = fixture.nativeElement.querySelector('.template-preview');
    expect(preview.textContent).toContain('What customers receive');
    expect(preview.textContent).toContain('Hi {{FirstName}}, welcome aboard!');
  });

  it('saves a step without sending any message text', () => {
    fixture.componentInstance.form.controls.messageTemplateId.setValue('t1');

    fixture.componentInstance.save();

    const req = http.expectOne(`${environment.apiBaseUrl}/campaigns/camp-1/steps`);
    expect(req.request.body.messageTemplateId).toBe('t1');
    expect('messageText' in req.request.body).toBeFalse();
    req.flush({ id: 'camp-1', steps: [] });
    expect(close).toHaveBeenCalled();
  });
});

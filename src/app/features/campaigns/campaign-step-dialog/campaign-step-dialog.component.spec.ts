import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { CampaignStepDialogComponent, CampaignStepDialogData } from './campaign-step-dialog.component';
import { SharedModule } from '../../../shared/shared.module';
import { MessageTemplateService } from '../../../core/services/message-template.service';
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
  headerMediaAssetId: null,
  headerOnMeta: false,
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
    expect(fixture.nativeElement.querySelector('.chat-preview')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chat-empty')).not.toBeNull();

    fixture.componentInstance.form.controls.messageTemplateId.setValue('t1');
    fixture.detectChanges();

    const preview: HTMLElement = fixture.nativeElement.querySelector('.chat-preview');
    expect(fixture.nativeElement.textContent).toContain('What customers receive');
    expect(preview.textContent).toContain('Hi {{FirstName}}, welcome aboard!');
    expect(preview.textContent).toContain('Approved');
    // The placeholder is picked out so it reads as "filled in per customer".
    expect(preview.querySelector('.chat-token')?.textContent).toBe('{{FirstName}}');
  });

  it("shows the selected template's image at the top of the preview", () => {
    const service = TestBed.inject(MessageTemplateService);
    expect(service).toBeTruthy();
    fixture.componentInstance.templates = [{ ...template, headerMediaAssetId: 'a1', headerOnMeta: true }];
    fixture.componentInstance.form.controls.messageTemplateId.setValue('t1');

    http
      .expectOne(`${environment.apiBaseUrl}/media/a1`)
      .flush({ id: 'a1', fileName: 'hero.png', contentType: 'image/png', sizeBytes: 10, url: 'https://cdn.example.test/hero.png', createdAt: '', isPublicUrl: true });
    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.chat-bubble__image');
    expect(img.src).toBe(`${window.location.origin}/hero.png`); // previewed from the portal's own API origin, not the public link
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

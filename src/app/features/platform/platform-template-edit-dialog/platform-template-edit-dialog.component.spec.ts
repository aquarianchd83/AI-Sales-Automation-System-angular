import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { MediaAsset } from '../../../core/models/media.model';
import { PlatformMessageTemplate } from '../../../core/models/platform-whatsapp.model';
import { PlatformMediaService } from '../../../core/services/platform-media.service';
import { PlatformMessageTemplatesService } from '../../../core/services/platform-message-templates.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTemplateEditDialogComponent, templateBodyValidator } from './platform-template-edit-dialog.component';

const image = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: 'i1',
  fileName: 'hero.png',
  contentType: 'image/png',
  sizeBytes: 1000,
  url: 'https://cdn.example.com/hero.png',
  createdAt: '2026-10-01T10:00:00Z',
  isPublicUrl: true,
  ...over,
});

const template = (over: Partial<PlatformMessageTemplate> = {}): PlatformMessageTemplate => ({
  id: 't1',
  eventKey: 'CreditsAdded',
  name: 'Credits added',
  language: 'en',
  category: 'Utility',
  whatsAppTemplateName: 'tenant_alert_credits_added',
  status: 'Pending',
  bodyText: 'Hi {{TenantName}}, good news. {{Message}} See the Billing page.',
  defaultBodyText: 'Hi {{TenantName}}, the default. {{Message}} See the Billing page.',
  sampleMessage: '1,000 WhatsApp messages were added.',
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

describe('PlatformTemplateEditDialogComponent', () => {
  let api: jasmine.SpyObj<PlatformMessageTemplatesService>;
  let media: jasmine.SpyObj<PlatformMediaService>;
  let ref: jasmine.SpyObj<MatDialogRef<PlatformTemplateEditDialogComponent>>;

  const create = (t: PlatformMessageTemplate, images: MediaAsset[] = [image()]) => {
    api = jasmine.createSpyObj('PlatformMessageTemplatesService', ['update']);
    api.update.and.callFake((_, request) => of({ ...t, ...request, headerMediaAssetId: request.headerMediaAssetId ?? t.headerMediaAssetId } as unknown as PlatformMessageTemplate));
    media = jasmine.createSpyObj('PlatformMediaService', ['getAll']);
    media.getAll.and.returnValue(of(images));
    ref = jasmine.createSpyObj('MatDialogRef', ['close']);

    TestBed.configureTestingModule({
      declarations: [PlatformTemplateEditDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformMessageTemplatesService, useValue: api },
        { provide: PlatformMediaService, useValue: media },
        { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: { template: t } },
      ],
    });

    const fixture = TestBed.createComponent(PlatformTemplateEditDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  };

  it('shows a live preview with sample values', () => {
    const { fixture, component, text } = create(template());

    expect(text()).toContain('Hi Acme Traders, good news. 1,000 WhatsApp messages were added. See the Billing page.');

    component.form.controls.bodyText.setValue('Hello {{TenantName}}. {{Title}} {{Message}} Thanks for staying.');
    fixture.detectChanges();
    expect(text()).toContain('Hello Acme Traders. Your plan renews soon 1,000 WhatsApp messages were added. Thanks for staying.');
  });

  it('refuses a body Meta or the notice cannot use', () => {
    const { component } = create(template());
    const body = component.form.controls.bodyText;

    body.setValue('Hi {{Frist}}, something to say here. {{Message}} Thanks.');
    expect(body.hasError('unknownTokens')).toBeTrue();
    expect(component.unknownTokens).toEqual(['Frist']);

    body.setValue('{{TenantName}}, something to say here. {{Message}} Thanks.');
    expect(body.hasError('edgeToken')).toBeTrue();

    body.setValue('Hi {{TenantName}}, something to say here. {{Message}}');
    expect(body.hasError('edgeToken')).toBeTrue();

    body.setValue('x'.repeat(1025));
    expect(body.hasError('maxlength')).toBeTrue();

    body.setValue('');
    expect(body.hasError('required')).toBeTrue();
    expect(templateBodyValidator(body)).toBeNull();

    body.setValue('Hi {{TenantName}}, fine wording here. {{Message}} Thanks.');
    expect(body.valid).toBeTrue();
  });

  it('inserts a placeholder at the cursor', () => {
    const { fixture, component } = create(template({ bodyText: 'Hi , bye' }));
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(3, 3);

    component.insert('TenantName');

    expect(component.form.controls.bodyText.value).toBe('Hi {{TenantName}}, bye');
    expect(component.form.dirty).toBeTrue();
  });

  it('puts the default text back', () => {
    const { component } = create(template());

    component.restoreDefault();

    expect(component.form.controls.bodyText.value).toContain('the default');
  });

  it('offers a JPEG or PNG up to 5 MB, or an MP4 or 3GPP video up to 16 MB', () => {
    const { component } = create(template(), [
      image(),
      image({ id: 'i2', fileName: 'clip.mp4', contentType: 'video/mp4' }),
      image({ id: 'i3', fileName: 'huge.png', sizeBytes: 6 * 1024 * 1024 }),
      image({ id: 'i4', fileName: 'photo.jpg', contentType: 'image/jpeg' }),
      image({ id: 'i5', fileName: 'huge.mp4', contentType: 'video/mp4', sizeBytes: 17 * 1024 * 1024 }),
      image({ id: 'i6', fileName: 'still.webp', contentType: 'image/webp' }),
    ]);

    expect(component.images.map((i) => i.fileName)).toEqual(['hero.png', 'clip.mp4', 'photo.jpg']);
  });

  it('saves the edit, sending the image only when it changed', () => {
    const { component } = create(template());
    component.form.patchValue({ name: ' Credits added! ', headerMediaAssetId: 'i1' });

    component.save();

    expect(api.update).toHaveBeenCalledWith('t1', {
      name: 'Credits added!',
      bodyText: 'Hi {{TenantName}}, good news. {{Message}} See the Billing page.',
      isActive: true,
      headerMediaAssetId: 'i1',
      removeHeaderImage: false,
    });
    expect(ref.close).toHaveBeenCalled();
  });

  it('keeps the current image when it is not changed, and removes it on request', () => {
    const { component } = create(template({ headerMediaAssetId: 'i1' }));

    component.save();
    expect(api.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ headerMediaAssetId: null, removeHeaderImage: false }));

    component.form.patchValue({ headerMediaAssetId: '' });
    component.save();
    expect(api.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ headerMediaAssetId: null, removeHeaderImage: true }));
  });

  it('does not save an invalid body', () => {
    const { component } = create(template());
    component.form.controls.bodyText.setValue('Hi {{Nope}}, wording that is long enough. {{Message}} Thanks.');

    component.save();

    expect(api.update).not.toHaveBeenCalled();
  });

  it('locks the image once Meta holds the template without one, and forbids removing one it holds with one', () => {
    expect(create(template({ metaTemplateId: 'm1', headerMediaAssetId: null })).component.headerLocked).toBeTrue();

    TestBed.resetTestingModule();
    const withImage = create(template({ metaTemplateId: 'm1', headerMediaAssetId: 'i1', headerOnMeta: true }));
    expect(withImage.component.headerLocked).toBeFalse();
    expect(withImage.component.headerRequired).toBeTrue();
  });
});

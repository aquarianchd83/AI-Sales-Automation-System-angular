import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import {
  duplicateName,
  duplicateWhatsAppName,
  TemplateFormDialogComponent,
  TemplateFormDialogData,
} from './template-form-dialog.component';
import { MessageTemplate } from '../../../core/models/message-template.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';

const onMeta: MessageTemplate = {
  id: 't1',
  name: 'test',
  language: 'en',
  category: 'Utility',
  whatsAppTemplateName: 'create_template_from_portal',
  whatsAppTemplateStatus: 'Approved',
  bodyText: 'Hi {{FirstName}}',
  isActive: true,
  createdAt: '2026-09-01T00:00:00Z',
  metaTemplateId: '1387908590149880',
  headerMediaAssetId: null,
  headerOnMeta: false,
};

describe('TemplateFormDialogComponent category from Meta', () => {
  let fixture: ComponentFixture<TemplateFormDialogComponent>;
  let http: HttpTestingController;
  const close = jasmine.createSpy('close');

  function open(template: MessageTemplate): void {
    TestBed.configureTestingModule({
      declarations: [TemplateFormDialogComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { mode: 'edit', template } as TemplateFormDialogData },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TemplateFormDialogComponent);
    fixture.detectChanges();
  }

  beforeEach(() => close.calls.reset());

  it('offers "Update category from Meta" for a template that is on Meta', () => {
    open(onMeta);

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Update category from Meta');
    expect(text).toContain('Meta assigns its category');
    expect(fixture.nativeElement.querySelector('mat-select[formcontrolname=category]')).toBeNull();
  });

  it('shows the category Meta has after the update, and refreshes the list when closed', () => {
    open(onMeta);
    const notify = spyOn(TestBed.inject(NotificationService), 'success');

    fixture.componentInstance.updateCategoryFromMeta();
    http
      .expectOne(`${environment.apiBaseUrl}/message-templates/t1/sync`)
      .flush({ template: { ...onMeta, category: 'Marketing' }, pushError: null });
    fixture.detectChanges();

    expect(fixture.componentInstance.shownCategory).toBe('Marketing');
    expect(fixture.nativeElement.querySelector('.category-now').textContent).toContain('Marketing');
    expect(notify).toHaveBeenCalledWith(jasmine.stringContaining('Marketing'));

    fixture.componentInstance.cancel();
    expect(close).toHaveBeenCalledWith(true);
    http.verify();
  });

  it('keeps the category editable for a template not on Meta yet', () => {
    open({ ...onMeta, metaTemplateId: null });

    expect(fixture.nativeElement.querySelector('mat-select[formcontrolname=category]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Update category from Meta');
    fixture.componentInstance.cancel();
    expect(close).toHaveBeenCalledWith(false);
  });
});

describe('TemplateFormDialogComponent image', () => {
  const asset = { id: 'a1', fileName: 'hero.png', contentType: 'image/png', sizeBytes: 2048, url: 'https://cdn.example.test/hero.png', createdAt: '', isPublicUrl: true };
  let http: HttpTestingController;
  const close = jasmine.createSpy('close');

  function open(mode: 'create' | 'edit', template?: MessageTemplate): ComponentFixture<TemplateFormDialogComponent> {
    TestBed.configureTestingModule({
      declarations: [TemplateFormDialogComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { mode, template } as TemplateFormDialogData },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TemplateFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => close.calls.reset());

  it('lets a new template pick an image and sends it with the template', () => {
    const fixture = open('create');
    expect(fixture.nativeElement.textContent).toContain('Image');
    expect(fixture.componentInstance.imageMode).toBe('free');

    fixture.componentInstance.headerAsset = asset;
    fixture.componentInstance.form.patchValue({
      name: 'Welcome',
      whatsAppTemplateName: 'welcome_offer',
      bodyText: 'Hi {{FirstName}}',
    });
    fixture.componentInstance.save();

    const req = http.expectOne(`${environment.apiBaseUrl}/message-templates`);
    expect(req.request.body.headerMediaAssetId).toBe('a1');
    req.flush({ ...onMeta, id: 'new', metaTemplateId: null });
    http.verify();
  });

  it('only offers JPEG or PNG files up to 5 MB, the limits Meta sets for a message image', () => {
    const c = open('create').componentInstance;

    expect(c.isUsableImage({ ...asset, contentType: 'image/jpeg' })).toBeTrue();
    expect(c.isUsableImage({ ...asset, contentType: 'image/webp' })).toBeFalse();
    expect(c.isUsableImage({ ...asset, contentType: 'video/mp4' })).toBeFalse();
    expect(c.isUsableImage({ ...asset, sizeBytes: 5 * 1024 * 1024 + 1 })).toBeFalse();
  });

  it('a template on Meta with an image can swap it but not remove it', () => {
    const fixture = open('edit', { ...onMeta, headerMediaAssetId: 'a1', headerOnMeta: true });
    http.expectOne(`${environment.apiBaseUrl}/media/a1`).flush(asset);
    fixture.detectChanges();

    expect(fixture.componentInstance.imageMode).toBe('swap');
    expect(fixture.componentInstance.headerAsset?.fileName).toBe('hero.png');
    expect(fixture.nativeElement.querySelector('button[aria-label="Remove the image"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.image-preview img')).not.toBeNull();

    fixture.componentInstance.headerAsset = { ...asset, id: 'a2' };
    fixture.componentInstance.save();
    const req = http.expectOne(`${environment.apiBaseUrl}/message-templates/t1`);
    expect(req.request.body.headerMediaAssetId).toBe('a2');
    expect(req.request.body.removeHeaderImage).toBeUndefined();
    req.flush(onMeta);
  });

  it('a template on Meta without an image cannot get one, and says why', () => {
    const fixture = open('edit', onMeta);

    expect(fixture.componentInstance.imageMode).toBe('locked');
    expect(fixture.nativeElement.textContent).toContain('make a copy of this template and add the image there');
    expect(fixture.nativeElement.querySelector('input[placeholder="Search the media library…"]')).toBeNull();
  });

  it('a template not yet on Meta can drop its image, which is sent as a removal', () => {
    const fixture = open('edit', { ...onMeta, metaTemplateId: null, headerMediaAssetId: 'a1' });
    http.expectOne(`${environment.apiBaseUrl}/media/a1`).flush(asset);
    fixture.detectChanges();

    fixture.componentInstance.removeImage();
    fixture.componentInstance.save();

    const req = http.expectOne(`${environment.apiBaseUrl}/message-templates/t1`);
    expect(req.request.body.removeHeaderImage).toBeTrue();
    req.flush({ ...onMeta, metaTemplateId: null });
  });
});

describe('template copy names', () => {
  it('names a copy, and a copy of a copy, so they never collide', () => {
    expect(duplicateName('Order confirmation')).toBe('Order confirmation (copy)');
    expect(duplicateName('Order confirmation (copy)')).toBe('Order confirmation (copy 2)');
    expect(duplicateName('Order confirmation (copy 2)')).toBe('Order confirmation (copy 3)');
  });

  it('gives a copy its own WhatsApp name, because Meta identifies a template by name and language', () => {
    expect(duplicateWhatsAppName('order_confirmation')).toBe('order_confirmation_v2');
    expect(duplicateWhatsAppName('order_confirmation_v2')).toBe('order_confirmation_v3');
    expect(duplicateWhatsAppName('offer_v9')).toBe('offer_v10');
  });
});

describe('TemplateFormDialogComponent duplicate and image upload', () => {
  const asset = { id: 'a1', fileName: 'hero.png', contentType: 'image/png', sizeBytes: 2048, url: 'https://cdn.example.test/hero.png', createdAt: '', isPublicUrl: true };
  const source: MessageTemplate = {
    ...onMeta,
    name: 'Welcome',
    whatsAppTemplateName: 'welcome_offer',
    category: 'Marketing',
    bodyText: 'Hi {{FirstName}}, welcome!',
    headerMediaAssetId: 'a1',
    headerOnMeta: true,
  };
  let http: HttpTestingController;
  const close = jasmine.createSpy('close');

  function open(mode: TemplateFormDialogData['mode'], template?: MessageTemplate): ComponentFixture<TemplateFormDialogComponent> {
    TestBed.configureTestingModule({
      declarations: [TemplateFormDialogComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { mode, template } as TemplateFormDialogData },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TemplateFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  const file = (name: string, type: string, size = 1024): File => new File([new Uint8Array(size)], name, { type });

  beforeEach(() => close.calls.reset());

  it('a duplicate is the create form pre-filled from the source, with names of its own', () => {
    const fixture = open('duplicate', source);
    http.expectOne(`${environment.apiBaseUrl}/media/a1`).flush(asset);
    fixture.detectChanges();
    const c = fixture.componentInstance;

    expect(c.isEdit).toBeFalse();
    expect(c.form.getRawValue()).toEqual(
      jasmine.objectContaining({ name: 'Welcome (copy)', whatsAppTemplateName: 'welcome_offer_v2', category: 'Marketing', bodyText: 'Hi {{FirstName}}, welcome!', language: 'en' })
    );
    expect(fixture.nativeElement.textContent).toContain('Duplicate template');
    expect(fixture.nativeElement.textContent).toContain('goes through review again');
    // The copy is a new template, so its image is free to change even though the original's is fixed on Meta.
    expect(c.imageMode).toBe('free');
    expect(c.headerAsset?.id).toBe('a1');
    http.verify();
  });

  it('saving a duplicate creates a NEW template carrying the image - it never edits the original', () => {
    const fixture = open('duplicate', source);
    http.expectOne(`${environment.apiBaseUrl}/media/a1`).flush(asset);
    fixture.detectChanges();

    fixture.componentInstance.save();

    const req = http.expectOne(`${environment.apiBaseUrl}/message-templates`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      jasmine.objectContaining({ name: 'Welcome (copy)', whatsAppTemplateName: 'welcome_offer_v2', headerMediaAssetId: 'a1', bodyText: 'Hi {{FirstName}}, welcome!' })
    );
    req.flush({ ...source, id: 'new', metaTemplateId: null });
    expect(close).toHaveBeenCalledWith(true);
    http.verify();
  });

  it('a duplicate of a template with no image can get one - the way round Meta fixing it at creation', () => {
    const fixture = open('duplicate', onMeta);

    expect(fixture.componentInstance.imageMode).toBe('free');
    expect(fixture.nativeElement.querySelector('input[placeholder="Search the media library…"]')).not.toBeNull();
    http.verify();
  });

  it('a template on Meta without an image offers to duplicate it, and hands that back to the list', () => {
    const fixture = open('edit', onMeta);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.image-duplicate');

    expect(button.textContent).toContain('Duplicate as a new template');
    button.click();

    expect(close).toHaveBeenCalledWith('duplicate');
  });

  it('uploads a picture from the dialog and attaches it in one step', () => {
    const fixture = open('create');
    const c = fixture.componentInstance;

    c.uploadImage(file('hero.png', 'image/png'));
    expect(c.uploadingImage).toBeTrue();
    const req = http.expectOne(`${environment.apiBaseUrl}/media/upload`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('file')).toEqual(jasmine.any(File));
    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    expect(c.uploadProgress).toBe(50);
    req.flush(asset);

    expect(c.uploadingImage).toBeFalse();
    expect(c.headerAsset?.id).toBe('a1');
    http.verify();
  });

  it('refuses a file Meta would reject before uploading anything', () => {
    const fixture = open('create');
    const error = spyOn(TestBed.inject(NotificationService), 'error');

    fixture.componentInstance.uploadImage(file('clip.mp4', 'video/mp4'));
    fixture.componentInstance.uploadImage(file('huge.png', 'image/png', 5 * 1024 * 1024 + 1));

    expect(error).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.uploadingImage).toBeFalse();
    http.verify(); // no request was made
  });

  it('keeps nothing attached when the upload fails, so it can be retried', () => {
    const fixture = open('create');
    const c = fixture.componentInstance;

    c.uploadImage(file('hero.png', 'image/png'));
    http.expectOne(`${environment.apiBaseUrl}/media/upload`).flush({ title: 'Storage unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    expect(c.uploadingImage).toBeFalse();
    expect(c.headerAsset).toBeNull();
  });

  it('a template on Meta without an image has no upload button (Meta fixes that at creation)', () => {
    const fixture = open('edit', onMeta);

    expect(fixture.nativeElement.querySelector('.image-upload')).toBeNull();
    http.verify();
  });
});

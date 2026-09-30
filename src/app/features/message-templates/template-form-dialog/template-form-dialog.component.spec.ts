import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { TemplateFormDialogComponent, TemplateFormDialogData } from './template-form-dialog.component';
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
    expect(fixture.nativeElement.textContent).toContain('create a new template with an image');
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

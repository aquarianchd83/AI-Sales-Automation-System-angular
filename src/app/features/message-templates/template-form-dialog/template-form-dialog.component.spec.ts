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

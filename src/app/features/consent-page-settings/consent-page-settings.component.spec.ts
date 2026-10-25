import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { ConsentPagePreview, ConsentPageSettings } from '../../core/models/consent-page.model';
import { ConsentPageService } from '../../core/services/consent-page.service';
import { NotificationService } from '../../core/services/notification.service';
import { SharedModule } from '../../shared/shared.module';
import { ConsentPageSettingsComponent } from './consent-page-settings.component';

const DEFAULT = 'I agree to receive WhatsApp messages from [Business Name] about eye tests, including relevant follow-ups. I understand that I can opt out at any time.';

const incomplete: ConsentPageSettings = {
  businessName: null,
  productDescription: null,
  additionalInfo: null,
  consentStatement: null,
  defaultConsentStatement: DEFAULT,
  privacyPolicyUrl: null,
  termsUrl: null,
  status: 'Incomplete',
  isActive: true,
  publishedVersion: 0,
  publishedAtUtc: null,
  hasUnpublishedChanges: false,
  issues: [
    { field: 'businessName', message: 'Enter the business or product name.' },
    { field: 'productDescription', message: 'Describe the product or service in a sentence or two.' },
  ],
};

const published: ConsentPageSettings = {
  ...incomplete,
  businessName: 'Acme Eye Care',
  productDescription: 'Eye tests and glasses for the whole family.',
  status: 'Published',
  publishedVersion: 2,
  publishedAtUtc: '2026-10-25T10:00:00Z',
  issues: [],
};

describe('ConsentPageSettingsComponent', () => {
  let fixture: ComponentFixture<ConsentPageSettingsComponent>;
  let component: ConsentPageSettingsComponent;
  let service: jasmine.SpyObj<ConsentPageService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialog: { open: jasmine.Spy };
  let confirmed = true;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const buttonLabelled = (label: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find((b) => (b.textContent ?? '').includes(label));

  function create(settings: ConsentPageSettings = incomplete): void {
    service.get.and.returnValue(of(settings));
    fixture = TestBed.createComponent(ConsentPageSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    confirmed = true;
    service = jasmine.createSpyObj('ConsentPageService', ['get', 'save', 'preview', 'publish', 'setActive']);
    service.save.and.callFake((request) => of({ ...incomplete, ...request, hasUnpublishedChanges: true, issues: [] } as ConsentPageSettings));
    service.publish.and.callFake(() => of(published));
    service.setActive.and.callFake((active) => of({ ...published, isActive: active, status: active ? 'Published' : 'Inactive' } as ConsentPageSettings));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    dialog = { open: jasmine.createSpy('open').and.callFake(() => ({ afterClosed: () => of(confirmed) })) };

    TestBed.configureTestingModule({
      declarations: [ConsentPageSettingsComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: ConsentPageService, useValue: service },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: dialog },
      ],
    });
  });

  it('shows the title, the status and what is still missing', () => {
    create();

    expect(text()).toContain('WhatsApp Consent Page Settings');
    expect(root().querySelector('[data-testid="status-chip"]')!.textContent).toContain('Incomplete');
    expect(text()).toContain('Enter the business or product name.');
    expect(text()).toContain('Customer discovery will not start until this is published.');
  });

  it('has the three actions: Save, Preview Consent Page and Publish Configuration', () => {
    create();

    expect(buttonLabelled('Save')).toBeDefined();
    expect(buttonLabelled('Preview Consent Page')).toBeDefined();
    expect(buttonLabelled('Publish Configuration')).toBeDefined();
  });

  it('shows the default consent wording and can use it', () => {
    create();
    component.form.controls.businessName.setValue('Acme Eye Care');
    fixture.detectChanges();

    expect(text()).toContain('I agree to receive WhatsApp messages from Acme Eye Care about eye tests');

    component.useDefaultStatement();

    expect(component.form.controls.consentStatement.value).toContain('from Acme Eye Care about eye tests');
  });

  it('Save sends the form (blank fields as null) and says customers will not see it until published', () => {
    create();
    component.form.patchValue({ businessName: '  Acme  ', productDescription: 'Eye tests.', additionalInfo: '   ' });

    component.onSave();

    expect(service.save).toHaveBeenCalledOnceWith({
      businessName: 'Acme',
      productDescription: 'Eye tests.',
      additionalInfo: null,
      consentStatement: null,
      privacyPolicyUrl: null,
      termsUrl: null,
    });
    expect(notify.success).toHaveBeenCalledWith(jasmine.stringMatching(/until you publish/));
    expect(service.publish).not.toHaveBeenCalled();
  });

  it('does not save text that looks like HTML, a link that is not https, or a statement that never mentions WhatsApp', () => {
    create();
    component.form.patchValue({
      businessName: '<b>Acme</b>',
      privacyPolicyUrl: 'http://acme.example/privacy',
      consentStatement: 'I agree to hear from you.',
    });

    component.onSave();

    expect(component.form.controls.businessName.hasError('markup')).toBeTrue();
    expect(component.form.controls.privacyPolicyUrl.invalid).toBeTrue();
    expect(component.form.controls.consentStatement.hasError('whatsapp')).toBeTrue();
    expect(service.save).not.toHaveBeenCalled();
  });

  it('accepts a full https link and a statement that mentions WhatsApp', () => {
    create();
    component.form.patchValue({ privacyPolicyUrl: 'https://acme.example/privacy', consentStatement: 'I agree to receive WhatsApp offers.' });

    expect(component.form.valid).toBeTrue();
  });

  it('Preview saves the draft first, then shows it - and sends nothing to a customer', () => {
    const preview: ConsentPagePreview = {
      page: { businessName: 'Acme', productDescription: 'Eye tests.', additionalInfo: null, consentStatement: 'I agree to receive WhatsApp messages from Acme.', privacyPolicyUrl: null, termsUrl: null, version: 0 },
      issues: [],
    };
    service.preview.and.returnValue(of(preview));
    create();
    component.form.patchValue({ businessName: 'Acme' });
    component.form.markAsDirty();

    component.onPreview();
    fixture.detectChanges();

    expect(service.save).toHaveBeenCalledBefore(service.preview);
    expect(root().querySelector('.preview')!.textContent).toContain('I agree to receive WhatsApp messages from Acme.');
    expect(root().querySelector<HTMLButtonElement>('.phone button[color="primary"]')!.disabled).toBeTrue();   // not interactive
    expect(service.publish).not.toHaveBeenCalled();
  });

  it('Publish asks first, saves unsaved edits, then publishes and confirms the version', () => {
    create();
    component.form.patchValue({ businessName: 'Acme Eye Care', productDescription: 'Eye tests and glasses for the whole family.' });
    component.form.markAsDirty();

    component.onPublish();

    expect(dialog.open).toHaveBeenCalled();
    expect(service.save).toHaveBeenCalledBefore(service.publish);
    expect(component.settings!.status).toBe('Published');
    expect(notify.success).toHaveBeenCalledWith(jasmine.stringMatching(/Published \(version 2\)/));
  });

  it('Publish does nothing when the tenant backs out of the confirmation', () => {
    confirmed = false;
    create();

    component.onPublish();

    expect(service.publish).not.toHaveBeenCalled();
  });

  it('when the server refuses to publish, the list of what is missing is refreshed', () => {
    create();
    service.publish.and.returnValue(throwError(() => new Error('400')));
    service.get.calls.reset();
    service.get.and.returnValue(of({ ...incomplete, issues: [{ field: 'productDescription', message: 'Describe the product or service in a sentence or two.' }] }));

    component.onPublish();

    expect(service.get).toHaveBeenCalledTimes(1);
    expect(component.issues.length).toBe(1);
    expect(component.settings!.status).toBe('Incomplete');
  });

  it('shows the live version, in the viewer\'s timezone, and lets the tenant switch the page off', () => {
    create(published);

    expect(root().querySelector('[data-testid="status-chip"]')!.textContent).toContain('Published');
    expect(text()).toContain('Version 2');
    expect(text()).toContain('published');
    expect(text()).not.toContain('2026-10-25T10:00:00Z');   // never the raw UTC string

    buttonLabelled('Switch off')!.click();
    fixture.detectChanges();

    expect(service.setActive).toHaveBeenCalledOnceWith(false);
    expect(component.settings!.status).toBe('Inactive');
    expect(buttonLabelled('Switch on')).toBeDefined();
  });

  it('shows "Unpublished changes" when the draft is ahead of the live version', () => {
    create({ ...published, hasUnpublishedChanges: true });

    expect(text()).toContain('Unpublished changes');
  });

  it('offers a retry when the settings cannot be loaded', () => {
    service.get.and.returnValue(throwError(() => new Error('offline')));
    fixture = TestBed.createComponent(ConsentPageSettingsComponent);
    fixture.detectChanges();

    expect(text()).toContain("couldn't load");

    service.get.and.returnValue(of(incomplete));
    buttonLabelled('Try again')!.click();
    fixture.detectChanges();

    expect(text()).toContain('WhatsApp consent statement');
  });
});

import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { CUSTOMER_LANGUAGES, CUSTOMER_SOURCES, withCurrent } from '../../../core/models/customer-options';
import { Customer } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TagService } from '../../../core/services/tag.service';
import { SharedModule } from '../../../shared/shared.module';
import { CustomerFormDialogComponent } from './customer-form-dialog.component';

describe('withCurrent', () => {
  it('adds nothing when there is no current value', () => {
    expect(withCurrent(CUSTOMER_SOURCES, null)).toEqual({ options: CUSTOMER_SOURCES, value: '' });
    expect(withCurrent(CUSTOMER_SOURCES, '  ').value).toBe('');
  });

  it('uses the option when the value differs only by case or spaces', () => {
    expect(withCurrent(CUSTOMER_SOURCES, ' website ')).toEqual({ options: CUSTOMER_SOURCES, value: 'Website' });
    expect(withCurrent(CUSTOMER_LANGUAGES, 'EN').value).toBe('en');
  });

  it('keeps a value the list does not know, so a dropdown never drops it', () => {
    const result = withCurrent(CUSTOMER_SOURCES, 'Lead discovery');

    expect(result.value).toBe('Lead discovery');
    expect(result.options.length).toBe(CUSTOMER_SOURCES.length + 1);
    expect(result.options[result.options.length - 1]).toEqual({ value: 'Lead discovery', label: 'Lead discovery' });
  });

  it('offers language codes with their names, and every code once', () => {
    const codes = CUSTOMER_LANGUAGES.map((l) => l.value);

    expect(CUSTOMER_LANGUAGES.find((l) => l.value === 'hi')?.label).toBe('Hindi');
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('en');
  });
});

describe('CustomerFormDialogComponent source and preferred language', () => {
  let customers: jasmine.SpyObj<CustomerService>;

  function create(customer?: Partial<Customer>) {
    const tags = jasmine.createSpyObj('TagService', ['getPaged']);
    tags.getPaged.and.returnValue(of({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 }));
    customers = jasmine.createSpyObj<CustomerService>('CustomerService', ['create', 'update', 'addTags', 'removeTag']);
    customers.create.and.callFake(() => of({ id: 'c1' } as Customer));
    customers.update.and.callFake(() => of({ id: 'c1' } as Customer));

    TestBed.configureTestingModule({
      declarations: [CustomerFormDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: customer ? { mode: 'edit', customer } : { mode: 'create' } },
        { provide: MatDialogRef, useValue: jasmine.createSpyObj('MatDialogRef', ['close']) },
        { provide: CustomerService, useValue: customers },
        { provide: TagService, useValue: tags },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']) },
      ],
    });
    const fixture = TestBed.createComponent(CustomerFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows both as dropdowns, not free-text boxes', () => {
    const root = create().nativeElement as HTMLElement;

    expect(root.querySelector('mat-select[formcontrolname="source"]')).toBeTruthy();
    expect(root.querySelector('mat-select[formcontrolname="preferredLanguage"]')).toBeTruthy();
    expect(root.querySelector('input[formcontrolname="source"]')).toBeNull();
    expect(root.querySelector('input[formcontrolname="preferredLanguage"]')).toBeNull();
  });

  it('offers the sources and the languages (by name), and "Not set"', () => {
    const fixture = create();
    const component = fixture.componentInstance;

    expect(component.sourceOptions.map((o) => o.value)).toEqual(CUSTOMER_SOURCES.map((o) => o.value));
    expect(component.languageOptions.find((o) => o.value === 'hi')?.label).toBe('Hindi');
    expect(component.form.controls.source.value).toBe(''); // Not set
    expect(component.form.controls.preferredLanguage.value).toBe('');
  });

  it('saves nothing for either when left on "Not set"', () => {
    const fixture = create();
    fixture.componentInstance.form.patchValue({ phoneNumberE164: '+919876543210' });

    fixture.componentInstance.save();

    expect(customers.create.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ source: null, preferredLanguage: null }));
  });

  it('saves the chosen source and language', () => {
    const fixture = create();
    fixture.componentInstance.form.patchValue({ phoneNumberE164: '+919876543210', source: 'Referral', preferredLanguage: 'hi' });

    fixture.componentInstance.save();

    expect(customers.create.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ source: 'Referral', preferredLanguage: 'hi' }));
  });

  it('keeps what an existing customer already has, even when it is not in the lists', () => {
    const fixture = create({ id: 'c1', phoneNumberE164: '+919876543210', source: 'Lead discovery', preferredLanguage: 'ja', tags: [] });
    const component = fixture.componentInstance;

    expect(component.form.controls.source.value).toBe('Lead discovery');
    expect(component.sourceOptions.some((o) => o.value === 'Lead discovery')).toBeTrue();
    expect(component.form.controls.preferredLanguage.value).toBe('ja');

    component.save();
    expect(customers.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ source: 'Lead discovery', preferredLanguage: 'ja' }));
  });

  it('shows an existing customer\'s lower-case "website" as the "Website" option', () => {
    const component = create({ id: 'c1', phoneNumberE164: '+919876543210', source: 'website', tags: [] }).componentInstance;

    expect(component.form.controls.source.value).toBe('Website');
    expect(component.sourceOptions.length).toBe(CUSTOMER_SOURCES.length); // nothing extra added
  });
});

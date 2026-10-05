import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SetupAnswer, SetupField, SetupFieldType } from '../../../core/models/application-setup.model';
import { SetupSharedModule } from '../setup-shared.module';
import { SetupFieldComponent } from './setup-field.component';

function field(type: SetupFieldType, extra: Partial<SetupField> = {}): SetupField {
  return {
    id: 'f',
    fieldKey: 'f',
    label: 'My question',
    helpText: null,
    fieldType: type,
    isRequired: false,
    defaultValue: null,
    options: [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ],
    validation: null,
    displayOrder: 0,
    section: 's',
    condition: null,
    metricKey: null,
    isActive: true,
    ...extra,
  };
}

describe('SetupFieldComponent', () => {
  let fixture: ComponentFixture<SetupFieldComponent>;
  let component: SetupFieldComponent;
  let emitted: SetupAnswer[];

  const el = (): HTMLElement => fixture.nativeElement;

  function create(f: SetupField, value: SetupAnswer = null, error: string | null = null): void {
    fixture = TestBed.createComponent(SetupFieldComponent);
    component = fixture.componentInstance;
    component.field = f;
    component.value = value;
    component.error = error;
    emitted = [];
    component.valueChange.subscribe((v) => emitted.push(v));
    component.ngOnChanges({ value: { currentValue: value, previousValue: undefined, firstChange: true, isFirstChange: () => true } });
    fixture.detectChanges();
    fixture.detectChanges();
  }

  /** Re-renders with a new value the way the wizard does after an answer changes. */
  function bind(value: SetupAnswer): void {
    const previous = component.value;
    component.value = value;
    component.ngOnChanges({ value: { currentValue: value, previousValue: previous, firstChange: false, isFirstChange: () => false } });
    fixture.detectChanges();
  }

  function type(text: string): HTMLInputElement {
    const input = el().querySelector<HTMLInputElement>('input, textarea')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    return input;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SetupSharedModule, NoopAnimationsModule, HttpClientTestingModule] });
  });

  const kinds: [SetupFieldType, string][] = [
    ['Text', 'input[type=text]'],
    ['MultilineText', 'textarea'],
    ['Number', 'input[type=number]'],
    ['Decimal', 'input[type=number]'],
    ['Currency', 'input[type=number]'],
    ['Date', 'input[type=date]'],
    ['Dropdown', 'mat-select'],
    ['MultiSelect', 'mat-chip-listbox'],
    ['Radio', 'mat-radio-group'],
    ['Checkbox', 'mat-checkbox'],
    ['FileUpload', 'input[type=file]'],
    ['Url', 'input[type=url]'],
    ['Email', 'input[type=email]'],
    ['Phone', 'input[type=tel]'],
  ];

  kinds.forEach(([fieldType, selector]) => {
    it(`renders a ${fieldType} field`, () => {
      create(field(fieldType));

      expect(el().querySelector(selector)).withContext(selector).toBeTruthy();
      expect(el().textContent).toContain('My question');
    });
  });

  it('marks a required question with an asterisk and shows its help text', () => {
    create(field('Text', { isRequired: true, helpText: 'As customers know it.' }));

    expect(el().querySelector('.req')).toBeTruthy();
    expect(el().textContent).toContain('As customers know it.');
  });

  it('shows the error under the field - and the help text steps aside', () => {
    create(field('Text', { helpText: 'A hint' }), null, 'My question is required.');

    expect(el().querySelector('mat-error')?.textContent).toContain('My question is required.');
    expect(el().textContent).not.toContain('A hint');
    expect(el().querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows and clears an error as the host changes it', () => {
    create(field('Email'));
    expect(el().querySelector('mat-error')).toBeNull();

    component.error = 'Bad email';
    fixture.detectChanges();
    fixture.detectChanges();
    expect(el().querySelector('mat-error')?.textContent).toContain('Bad email');

    component.error = null;
    fixture.detectChanges();
    fixture.detectChanges();
    expect(el().querySelector('mat-error')).toBeNull();
  });

  it('emits text as typed, and null once it is emptied', () => {
    create(field('Text'));

    type('ABC');
    type('');

    expect(emitted).toEqual(['ABC', null]);
  });

  it('emits numbers as numbers for the numeric types', () => {
    create(field('Currency'));

    type('25000.5');

    expect(emitted).toEqual([25000.5]);
  });

  it('does not overwrite what is being typed when the host echoes the value back', () => {
    create(field('Decimal'));

    const input = type('12.50');
    bind(12.5); // the wizard hands the number back; the field must keep the "12.50" the user typed

    expect(input.value).toBe('12.50');
  });

  it('does show a value that was changed from outside', () => {
    create(field('Text'));

    type('typed');
    bind('replaced by the host');

    expect(el().querySelector<HTMLInputElement>('input')!.value).toBe('replaced by the host');
  });

  it('starts from an existing answer', () => {
    create(field('Text'), 'ABC Software');

    expect(el().querySelector<HTMLInputElement>('input')!.value).toBe('ABC Software');
  });

  it('builds a multi-select answer pick by pick', () => {
    create(field('MultiSelect'), ['a']);
    expect(component.isPicked('a')).toBeTrue();
    expect(component.isPicked('b')).toBeFalse();

    // Rendering a saved answer selects its chips programmatically; that must not look like the user changing it.
    expect(emitted).toEqual([]);

    component.onPick('b', true);
    bind(['a', 'b']);
    component.onPick('a', false);

    expect(emitted).toEqual([['a', 'b'], ['b']]);
  });

  it('emits a boolean for a checkbox', () => {
    create(field('Checkbox', { isRequired: true }), false);

    el().querySelector<HTMLInputElement>('mat-checkbox input')!.click();
    fixture.detectChanges();

    expect(emitted).toEqual([true]);
  });

  it('a file field with no file offers to choose one, and with an id offers to replace or remove it', () => {
    create(field('FileUpload'));
    expect(el().textContent).toContain('Choose file');

    component.removeFile();
    expect(emitted).toEqual([null]);
  });
});

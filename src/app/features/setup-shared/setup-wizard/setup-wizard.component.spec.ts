import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SetupDefinition, SetupField, SetupFieldType } from '../../../core/models/application-setup.model';
import { SetupSharedModule } from '../setup-shared.module';
import { SetupSaveEvent, SetupWizardComponent } from './setup-wizard.component';

function field(key: string, type: SetupFieldType, section: string, order: number, extra: Partial<SetupField> = {}): SetupField {
  return {
    id: key,
    fieldKey: key,
    label: key.replace(/_/g, ' '),
    helpText: null,
    fieldType: type,
    isRequired: false,
    defaultValue: null,
    options: [],
    validation: null,
    displayOrder: order,
    section,
    condition: null,
    metricKey: null,
    isActive: true,
    ...extra,
  };
}

const yesNo = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const definition: SetupDefinition = {
  planId: 'p1',
  planCode: 'basic',
  planName: 'Basic Social',
  versionId: 'v1',
  versionNumber: 1,
  sections: [
    {
      key: 'business',
      title: 'Business Information',
      description: 'About your business',
      order: 0,
      fields: [
        field('brand_name', 'Text', 'business', 10, { isRequired: true }),
        field('contact_email', 'Email', 'business', 20, { isRequired: true }),
      ],
    },
    {
      key: 'campaign',
      title: 'Marketing & Campaign',
      description: '',
      order: 3,
      fields: [
        field('run_ads', 'Radio', 'campaign', 10, { isRequired: true, options: yesNo }),
        field('ad_budget', 'Currency', 'campaign', 20, { isRequired: true, condition: { fieldKey: 'run_ads', operator: 'Equals', value: 'yes' } }),
      ],
    },
    {
      // Every field here is conditional on an answer that is never given - the whole step must not appear.
      key: 'audience',
      title: 'Target Audience',
      description: '',
      order: 1,
      fields: [field('niche', 'Text', 'audience', 10, { isRequired: true, condition: { fieldKey: 'run_ads', operator: 'Equals', value: 'maybe' } })],
    },
  ],
};

describe('SetupWizardComponent', () => {
  let fixture: ComponentFixture<SetupWizardComponent>;
  let wizard: SetupWizardComponent;
  let saves: SetupSaveEvent[];

  const el = (): HTMLElement => fixture.nativeElement;
  const stepTitles = (): string[] => Array.from(el().querySelectorAll('.rail-label')).map((n) => n.textContent!.trim());
  const labelsShown = (): string[] =>
    Array.from(el().querySelectorAll('app-setup-field mat-label, app-setup-field legend')).map((n) => n.textContent!.replace(/\*/g, '').trim());
  const click = (text: string): void => {
    const button = Array.from(el().querySelectorAll<HTMLButtonElement>('footer button')).find((b) => b.textContent!.includes(text));
    expect(button).withContext(`button "${text}"`).toBeTruthy();
    button!.click();
    // Two passes: Material computes a field's error state while checking it, and renders the message on the next one.
    fixture.detectChanges();
    fixture.detectChanges();
  };
  const answer = (key: string, value: string | number | boolean | string[] | null): void => {
    const f = definition.sections.flatMap((s) => s.fields).find((x) => x.fieldKey === key)!;
    wizard.onValue(f, value);
    fixture.detectChanges();
  };

  function create(values = {}, mode: 'edit' | 'preview' = 'edit', extra: Partial<SetupWizardComponent> = {}): void {
    fixture = TestBed.createComponent(SetupWizardComponent);
    wizard = fixture.componentInstance;
    wizard.definition = definition;
    wizard.values = values;
    wizard.mode = mode;
    Object.assign(wizard, extra);
    saves = [];
    wizard.save.subscribe((e) => saves.push(e));
    wizard.ngOnChanges({
      definition: { currentValue: definition, previousValue: undefined, firstChange: true, isFirstChange: () => true },
      values: { currentValue: values, previousValue: undefined, firstChange: true, isFirstChange: () => true },
    });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SetupSharedModule, NoopAnimationsModule, HttpClientTestingModule] });
  });

  it('builds its steps from the definition: one per section that applies, then the review', () => {
    create();

    expect(stepTitles()).toEqual(['Business Information', 'Marketing & Campaign', 'Review & Confirm']);
    expect(el().textContent).not.toContain('Target Audience');
  });

  it('shows only the questions of the current step, and a conditional one only when its condition is met', () => {
    create();
    expect(labelsShown()).toEqual(['brand name', 'contact email']);

    wizard.goTo(1);
    fixture.detectChanges();
    expect(labelsShown()).toEqual(['run ads']);

    answer('run_ads', 'no');
    expect(labelsShown()).not.toContain('ad budget');

    answer('run_ads', 'yes');
    expect(labelsShown()).toEqual(['run ads', 'ad budget']);
  });

  it('counts progress over the required questions that currently apply', () => {
    create();
    expect(wizard.percent).toBe(0);
    expect(wizard.totalRequired).toBe(3); // brand, email, run_ads - the budget is hidden

    answer('brand_name', 'ABC');
    answer('run_ads', 'yes');
    expect(wizard.totalRequired).toBe(4);
    expect(wizard.percent).toBe(50);
  });

  it('refuses to continue past a step with a missing required answer and says why, next to the field', () => {
    create();
    answer('brand_name', 'ABC');

    click('Save & Continue');

    expect(saves.length).toBe(0);
    expect(wizard.current).toBe(0);
    expect(el().querySelector('mat-error')?.textContent).toContain('contact email is required.');
  });

  it('flags a badly formatted answer', () => {
    create();
    answer('brand_name', 'ABC');
    answer('contact_email', 'nope');

    click('Save & Continue');

    expect(saves.length).toBe(0);
    expect(el().querySelector('mat-error')?.textContent).toContain('valid email address');
  });

  it('saves only what changed, then moves on once the host reports the save done', () => {
    create({ brand_name: 'Old Name', contact_email: 'a@b.co' });
    wizard.goTo(0);
    answer('brand_name', 'New Name');

    click('Save & Continue');

    expect(saves.length).toBe(1);
    expect(saves[0].values).toEqual({ brand_name: 'New Name' });
    expect(saves[0].complete).toBeFalse();
    expect(wizard.current).toBe(0); // still waiting for the host

    saves[0].done({ ok: true });
    fixture.detectChanges();
    expect(wizard.current).toBe(1);
  });

  it('stays put when the save fails', () => {
    create({ brand_name: 'A', contact_email: 'a@b.co' });
    wizard.goTo(0);
    answer('brand_name', 'B');
    click('Save & Continue');

    saves[0].done({ ok: false });

    expect(wizard.current).toBe(0);
  });

  it('Save & Exit keeps whatever is filled in, valid or not', () => {
    create();
    answer('brand_name', 'ABC');

    click('Save & Exit');

    expect(saves.length).toBe(1);
    expect(saves[0].exit).toBeTrue();
    expect(saves[0].values).toEqual({ brand_name: 'ABC' });
  });

  it('clearing an answer is sent as null', () => {
    create({ brand_name: 'ABC', contact_email: 'a@b.co' });
    answer('brand_name', null);
    click('Save & Exit');

    expect(saves[0].values).toEqual({ brand_name: null });
  });

  it('lists every answer on the review step, and will not complete while something is wrong', () => {
    create({ brand_name: 'ABC', contact_email: 'bad', run_ads: 'no' });
    wizard.goTo(2);
    fixture.detectChanges();

    expect(wizard.isReview).toBeTrue();
    expect(el().querySelector('.review-section')?.textContent).toContain('ABC');
    expect(el().querySelector('.banner.problem')?.textContent).toContain('1 answer needs attention');

    click('Complete setup');

    expect(saves.length).toBe(0);
    expect(wizard.current).toBe(0); // sent back to the step with the problem
    expect(el().querySelector('mat-error')?.textContent).toContain('valid email address');
  });

  it('confirms the setup from the review step once everything is valid', () => {
    create({ brand_name: 'ABC', contact_email: 'a@b.co', run_ads: 'no' });
    wizard.goTo(2);
    fixture.detectChanges();

    click('Complete setup');

    expect(saves.length).toBe(1);
    expect(saves[0].complete).toBeTrue();
    expect(saves[0].values).toEqual({});
  });

  it('offers "Save changes" rather than "Complete setup" for a setup that was already complete', () => {
    create({ brand_name: 'ABC', contact_email: 'a@b.co', run_ads: 'no' }, 'edit', { alreadyCompleted: true, startAtReview: true });

    expect(wizard.isReview).toBeTrue();
    expect(el().querySelector('footer')?.textContent).toContain('Save changes');
  });

  it('opens on the first step that still needs something', () => {
    create({ brand_name: 'ABC', contact_email: 'a@b.co' });

    expect(wizard.current).toBe(1); // run_ads is still missing
  });

  it('shows the server\'s own objection when it disagrees with the client', () => {
    create({ brand_name: 'ABC', contact_email: 'a@b.co' });
    wizard.goTo(0);
    answer('brand_name', 'ABC 2');
    click('Save & Continue');

    saves[0].done({ ok: true, evaluation: { isComplete: false, percentComplete: 0, visibleFieldKeys: [], missing: [], invalid: [{ fieldKey: 'contact_email', message: 'Server says no.' }], sections: [] } });
    wizard.goTo(0);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(el().querySelector('mat-error')?.textContent).toContain('Server says no.');
  });

  it('in preview mode behaves the same but never asks the host to save', () => {
    create({}, 'preview');
    answer('brand_name', 'ABC');
    answer('contact_email', 'a@b.co');

    click('Next');

    expect(saves.length).toBe(0);
    expect(wizard.current).toBe(1);
    expect(el().querySelector('.eyebrow')?.textContent).toContain('nothing is saved');
  });
});

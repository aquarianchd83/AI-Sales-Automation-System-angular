import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AnswerMap, QuestionnaireDefinition } from '../../../core/models/content-studio.model';
import { SharedModule } from '../../shared.module';
import { QuestionnaireFormComponent } from './questionnaire-form.component';

const DEFINITION: QuestionnaireDefinition = {
  questions: [
    { key: 'name', type: 'ShortText', prompt: 'What is your business called?', required: true },
    { key: 'has_offer', type: 'Boolean', prompt: 'Any current offer?' },
    { key: 'offer', type: 'ShortText', prompt: 'What is the offer?', showWhen: { questionKey: 'has_offer', operator: 'Equal', value: true } },
    {
      key: 'services',
      type: 'MultiChoice',
      prompt: 'Which services?',
      options: [
        { value: 'cataract', label: 'Cataract' },
        { value: 'lasik', label: 'LASIK' },
      ],
    },
    {
      key: 'size',
      type: 'SingleChoice',
      prompt: 'How big?',
      options: [
        { value: 'small', label: 'Small' },
        { value: 'large', label: 'Large' },
      ],
    },
    {
      key: 'hours',
      type: 'Structured',
      prompt: 'When are you open?',
      fields: [
        { key: 'weekdays', label: 'Mon-Fri', type: 'ShortText', required: true },
        { key: 'saturday', label: 'Saturday', type: 'ShortText' },
      ],
    },
    { key: 'staff', type: 'Number', prompt: 'How many staff?', min: 0 },
  ],
};

describe('QuestionnaireFormComponent', () => {
  let fixture: ComponentFixture<QuestionnaireFormComponent>;
  let emitted: AnswerMap[];

  function render(answers: AnswerMap = {}, extra: Partial<QuestionnaireFormComponent> = {}): HTMLElement {
    TestBed.configureTestingModule({ imports: [SharedModule, NoopAnimationsModule] });
    fixture = TestBed.createComponent(QuestionnaireFormComponent);
    fixture.componentInstance.definition = DEFINITION;
    fixture.componentInstance.answers = answers;
    Object.assign(fixture.componentInstance, extra);
    emitted = [];
    fixture.componentInstance.answersChange.subscribe((a) => emitted.push(a));
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const questionKeys = (el: HTMLElement) => Array.from(el.querySelectorAll('[data-question]')).map((e) => e.getAttribute('data-question'));
  const refresh = () => {
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
  };
  /** The component is OnPush: a change made from code (not from an event in its own template) has to mark it for checking. */
  const repaint = () => {
    fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  };

  it('asks only the questions that are visible, numbered without gaps', () => {
    const el = render();

    expect(questionKeys(el)).toEqual(['name', 'has_offer', 'services', 'size', 'hours', 'staff']);
    expect(Array.from(el.querySelectorAll('.number')).map((n) => n.textContent?.trim())).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('shows a conditional question once its condition is answered', () => {
    const el = render({ has_offer: true });

    expect(questionKeys(el)).toContain('offer');
    expect(Array.from(el.querySelectorAll('.number')).map((n) => n.textContent?.trim()).length).toBe(7);
  });

  it('marks required questions', () => {
    const el = render();

    expect(el.querySelector('[data-question="name"] .required')).not.toBeNull();
    expect(el.querySelector('[data-question="has_offer"] .required')).toBeNull();
  });

  it('emits the new answers when text is typed, and drops the answer when it is emptied', () => {
    const el = render({ name: 'Old' });
    const input = el.querySelector('[data-question="name"] input') as HTMLInputElement;

    input.value = 'New name';
    input.dispatchEvent(new Event('input'));
    expect(emitted.pop()).toEqual({ name: 'New name' });

    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    expect(emitted.pop()).toEqual({});
  });

  it('reveals the conditional question as soon as the answer is given, and hides it again', () => {
    const el = render();
    const component = fixture.componentInstance;

    component.setBool(DEFINITION.questions[1], true);
    repaint();
    expect(questionKeys(el)).toContain('offer');

    component.setBool(DEFINITION.questions[1], false);
    repaint();
    expect(questionKeys(el)).not.toContain('offer');
  });

  it('keeps a list of picked options', () => {
    render();
    const component = fixture.componentInstance;
    const services = DEFINITION.questions[3];

    component.togglePick(services, 'cataract', true);
    component.togglePick(services, 'lasik', true);
    expect(emitted[emitted.length - 1]).toEqual({ services: ['cataract', 'lasik'] });

    component.togglePick(services, 'cataract', false);
    expect(emitted[emitted.length - 1]).toEqual({ services: ['lasik'] });

    component.togglePick(services, 'lasik', false);
    expect(emitted[emitted.length - 1]).toEqual({});
  });

  it('builds a structured answer from its fields', () => {
    render();
    const component = fixture.componentInstance;
    const hours = DEFINITION.questions[5];

    component.setFieldText(hours, hours.fields![0], '9-6');
    component.setFieldText(hours, hours.fields![1], '9-1');
    expect(emitted[emitted.length - 1]).toEqual({ hours: { weekdays: '9-6', saturday: '9-1' } });

    component.setFieldText(hours, hours.fields![1], '');
    expect(emitted[emitted.length - 1]).toEqual({ hours: { weekdays: '9-6' } });
  });

  it('turns a typed number into a number, and ignores nonsense', () => {
    render();
    const component = fixture.componentInstance;
    const staff = DEFINITION.questions[6];

    component.setNumber(staff, '12');
    expect(emitted[emitted.length - 1]).toEqual({ staff: 12 });

    component.setNumber(staff, 'abc');
    expect(emitted[emitted.length - 1]).toEqual({});
  });

  it('shows the message for a question, and for a structured field', () => {
    const el = render({ hours: { saturday: '9-1' } }, { errors: { name: 'This question needs an answer.', 'hours.weekdays': 'Mon-Fri needs an answer.' } });

    expect(el.querySelector('[data-question="name"]')?.classList).toContain('question--error');
    expect(el.querySelector('[data-question="name"] .error')?.textContent).toContain('needs an answer');
    expect(el.querySelector('[data-field="weekdays"] .error')?.textContent).toContain('Mon-Fri needs an answer');
  });

  it('cannot be edited when read-only', () => {
    const el = render({ name: 'Locked' }, { readonly: true });
    refresh();

    expect((el.querySelector('[data-question="name"] input') as HTMLInputElement).disabled).toBeTrue();
  });

  it('says so when there are no questions', () => {
    TestBed.configureTestingModule({ imports: [SharedModule, NoopAnimationsModule] });
    fixture = TestBed.createComponent(QuestionnaireFormComponent);
    fixture.componentInstance.definition = null;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('no questions');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AnswerMap, QuestionnaireDefinition } from '../../../core/models/content-studio.model';
import { SharedModule } from '../../shared.module';
import { QuestionnaireFormComponent } from './questionnaire-form.component';

const DEFINITION: QuestionnaireDefinition = {
  questions: [
    { key: 'name', type: 'ShortText', prompt: 'Name?', required: true, requireKnown: true, helpText: 'What customers call you.', example: 'Sunrise Clinic' },
    { key: 'audience', type: 'LongText', prompt: 'Who are your customers?', required: true },
    { key: 'colours', type: 'ShortText', prompt: 'Colours?' },
  ],
};

describe('QuestionnaireFormComponent: not forcing people to invent answers', () => {
  let fixture: ComponentFixture<QuestionnaireFormComponent>;
  let emitted: AnswerMap[];

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

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

  it('shows the explanation and an example beside a question', () => {
    const el = render();

    const first = el.querySelector('[data-question="name"]')!;
    expect(text(first.querySelector('.help'))).toBe('What customers call you.');
    expect(text(first.querySelector('.example'))).toBe('For example: Sunrise Clinic');
    expect(el.querySelector('[data-question="colours"] .example')).toBeNull();
  });

  it('offers the three ways to skip a question, except on one that needs a real answer', () => {
    const el = render();

    expect(el.querySelector('[data-question="name"] [data-skip]')).toBeNull();
    const options = Array.from(el.querySelectorAll('[data-question="audience"] [data-skip]')).map((b) => [b.getAttribute('data-skip'), text(b)]);
    expect(options).toEqual([
      ['unknown', "I don't know"],
      ['need_help', 'I need help with this'],
      ['not_applicable', 'Not applicable'],
    ]);
  });

  it('records a skip as the answer, replaces the input with a note, and lets the tenant answer after all', () => {
    const el = render({ name: 'Sunrise' });

    (el.querySelector('[data-question="audience"] [data-skip="need_help"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(emitted.at(-1)!['audience']).toEqual({ $special: 'need_help' } as never);
    const note = el.querySelector('[data-question="audience"] .skipped')!;
    expect(text(note)).toContain('I need help with this');
    expect(el.querySelector('[data-question="audience"] textarea')).toBeNull();
    expect(el.querySelector('[data-question="audience"] [data-skip]')).toBeNull();

    (note.querySelector('button') as HTMLElement).click();
    fixture.detectChanges();

    expect(emitted.at(-1)!['audience']).toBeUndefined();
    expect(el.querySelector('[data-question="audience"] textarea')).not.toBeNull();
  });

  it('explains "not applicable" without promising to ask again', () => {
    const el = render({ audience: { $special: 'not_applicable' } as never });

    const note = text(el.querySelector('[data-question="audience"] .skipped'));
    expect(note).toContain('Not applicable');
    expect(note).not.toContain("we'll ask again");
  });

  it('offers no way to skip in a read-only form', () => {
    const el = render({ name: 'Sunrise' }, { readonly: true });

    expect(el.querySelector('[data-skip]')).toBeNull();
  });

  it('shows only the questions of one step, but numbers them by their place in the whole questionnaire', () => {
    const el = render({}, { stepKeys: ['audience'] });

    expect(el.querySelectorAll('[data-question]').length).toBe(1);
    expect(text(el.querySelector('[data-question="audience"] .number'))).toBe('2');
  });
});

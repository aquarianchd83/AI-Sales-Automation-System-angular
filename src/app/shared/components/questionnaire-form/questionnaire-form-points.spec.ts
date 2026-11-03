import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AnswerMap, QuestionnaireDefinition } from '../../../core/models/content-studio.model';
import { MAX_POINTS } from '../../../core/utils/questionnaire-engine';
import { SharedModule } from '../../shared.module';
import { QuestionnaireFormComponent } from './questionnaire-form.component';

const DEFINITION: QuestionnaireDefinition = {
  questions: [
    {
      key: 'problems_solved',
      type: 'PointList',
      prompt: 'What type of problem does your product solve?',
      required: true,
      requireKnown: true,
      helpText: 'One problem per point.',
    },
  ],
};

describe('QuestionnaireFormComponent: a list of points', () => {
  let fixture: ComponentFixture<QuestionnaireFormComponent>;
  let emitted: AnswerMap[];

  function render(answers: AnswerMap = {}, readonly = false): HTMLElement {
    TestBed.configureTestingModule({ imports: [SharedModule, NoopAnimationsModule] });
    fixture = TestBed.createComponent(QuestionnaireFormComponent);
    fixture.componentInstance.definition = DEFINITION;
    fixture.componentInstance.answers = answers;
    fixture.componentInstance.readonly = readonly;
    emitted = [];
    fixture.componentInstance.answersChange.subscribe((a) => emitted.push(a));
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const rows = (el: HTMLElement) => Array.from(el.querySelectorAll('[data-points] input')) as HTMLInputElement[];
  const type = (el: HTMLElement, index: number, value: string) => {
    const input = rows(el)[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const click = (el: HTMLElement, selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };

  it('starts with one empty point to type in, and no skip buttons because the question insists on an answer', () => {
    const el = render();

    expect(rows(el).length).toBe(1);
    expect(rows(el)[0].value).toBe('');
    expect(el.querySelector('[data-skip]')).toBeNull();
  });

  it('shows the points already answered, one per row', () => {
    const el = render({ problems_solved: ['Slow quotes', 'No follow-up'] });

    expect(rows(el).map((r) => r.value)).toEqual(['Slow quotes', 'No follow-up']);
  });

  it('puts what is typed into the answer as a list, without the blank rows', () => {
    const el = render();

    type(el, 0, '  Slow quotes  ');
    click(el, '[data-testid="add-point"]');
    expect(rows(el).length).toBe(2);   // the new empty row stays on screen
    expect(emitted[emitted.length - 1]).toEqual({ problems_solved: ['Slow quotes'] });

    type(el, 1, 'No follow-up');
    expect(emitted[emitted.length - 1]).toEqual({ problems_solved: ['Slow quotes', 'No follow-up'] });
  });

  it('removes a point, and the last row can only be cleared, not removed', () => {
    const el = render({ problems_solved: ['Slow quotes', 'No follow-up'] });

    click(el, '[data-remove-point="0"]');
    expect(rows(el).map((r) => r.value)).toEqual(['No follow-up']);
    expect(emitted[emitted.length - 1]).toEqual({ problems_solved: ['No follow-up'] });
    expect(el.querySelector('[data-remove-point]')).toBeNull();
  });

  it('drops the answer altogether when every point is cleared', () => {
    const el = render({ problems_solved: ['Slow quotes'] });

    type(el, 0, '');

    expect(emitted[emitted.length - 1]).toEqual({});
  });

  it('stops offering more rows at the limit', () => {
    const full = Array.from({ length: MAX_POINTS }, (_, i) => `Problem number ${i + 1}`);
    const el = render({ problems_solved: full });

    expect(rows(el).length).toBe(MAX_POINTS);
    expect(el.querySelector('[data-testid="add-point"]')).toBeNull();
  });

  it('follows the answers when they are changed from outside', () => {
    const el = render({ problems_solved: ['Slow quotes'] });

    fixture.componentInstance.answers = { problems_solved: ['One', 'Two', 'Three'].map((p) => p + ' problem') };
    fixture.componentInstance.ngOnChanges();
    // The component is OnPush: a change made from code has to mark it for checking (a parent binding does this itself).
    fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();

    expect(rows(el).map((r) => r.value)).toEqual(['One problem', 'Two problem', 'Three problem']);
  });

  it('is read-only on request: no typing, adding or removing', () => {
    const el = render({ problems_solved: ['Slow quotes', 'No follow-up'] }, true);

    expect(rows(el).every((r) => r.disabled)).toBeTrue();
    expect(el.querySelector('[data-testid="add-point"]')).toBeNull();
    expect(el.querySelector('[data-remove-point]')).toBeNull();
  });
});

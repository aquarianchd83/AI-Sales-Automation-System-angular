import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject, of } from 'rxjs';

import {
  AnswerRevision,
  QuestionnaireDefinition,
  QuestionnaireResponseStatus,
  QuestionnaireState,
} from '../../../core/models/content-studio.model';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { AUTOSAVE_DELAY_MS, StudioQuestionnaireComponent } from './studio-questionnaire.component';

// One group, so the whole questionnaire is a single step.
const DEFINITION: QuestionnaireDefinition = {
  questions: [
    { key: 'business_name', type: 'ShortText', prompt: 'Name?', required: true, group: 'Basics' },
    { key: 'has_offer', type: 'Boolean', prompt: 'Offer?', group: 'Basics' },
    { key: 'offer', type: 'ShortText', prompt: 'What offer?', required: true, group: 'Basics', showWhen: { questionKey: 'has_offer', operator: 'Equal', value: true } },
  ],
};

// Three groups, so the wizard shows them one at a time.
const STEPPED: QuestionnaireDefinition = {
  questions: [
    { key: 'business_name', type: 'ShortText', prompt: 'Name?', required: true, requireKnown: true, group: 'About', example: 'Sunrise Clinic', helpText: 'What customers call you.' },
    { key: 'audience', type: 'LongText', prompt: 'Who are your customers?', required: true, group: 'Customers' },
    { key: 'brand', type: 'ShortText', prompt: 'Brand colours?', group: 'Brand' },
  ],
};

const state = (over: Partial<QuestionnaireState> = {}): QuestionnaireState => ({
  available: true,
  message: null,
  responseId: 'r1',
  templateId: 't1',
  templateTitle: 'Business basics',
  versionNumber: 1,
  status: QuestionnaireResponseStatus.InProgress,
  definition: DEFINITION,
  answers: { business_name: 'Trilok Eye Care' },
  visibleKeys: ['business_name', 'has_offer'],
  newerVersionAvailable: false,
  completedAtUtc: null,
  ...over,
});

const stepped = (answers: QuestionnaireState['answers'] = {}): QuestionnaireState =>
  state({ definition: STEPPED, answers, visibleKeys: ['business_name', 'audience', 'brand'] });

describe('StudioQuestionnaireComponent', () => {
  let fixture: ComponentFixture<StudioQuestionnaireComponent>;
  let studio: jasmine.SpyObj<ContentStudioService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const root = () => fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    (root().querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };

  function render(initial: QuestionnaireState): HTMLElement {
    studio = jasmine.createSpyObj('ContentStudioService', [
      'getQuestionnaire',
      'saveAnswers',
      'completeQuestionnaire',
      'restartQuestionnaire',
      'getAnswerHistory',
    ]);
    studio.getQuestionnaire.and.returnValue(of(initial));
    studio.getAnswerHistory.and.returnValue(of([]));
    studio.saveAnswers.and.returnValue(of(initial)); // leaving the page sends anything unsaved
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      declarations: [StudioQuestionnaireComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ContentStudioService, useValue: studio },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(StudioQuestionnaireComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('tells the tenant when there is no questionnaire for its business yet', () => {
    const el = render(state({ available: false, message: 'Your platform administrator has not published one.', definition: null, answers: {} }));

    expect(text(el.querySelector('.empty-card'))).toContain('has not published one');
    expect(el.querySelector('app-questionnaire-form')).toBeNull();
  });

  it('shows the questions with what the business profile already filled in', () => {
    const el = render(state());

    expect(el.querySelector('app-questionnaire-form')).not.toBeNull();
    expect((el.querySelector('[data-question="business_name"] input') as HTMLInputElement).value).toBe('Trilok Eye Care');
    expect(text(el.querySelector('.head'))).toContain('Business basics');
    expect(text(el.querySelector('.progress'))).toContain('1 of 1 required answered');
  });

  it('counts only the required questions that are asked', () => {
    render(state());
    const component = fixture.componentInstance;
    expect(component.progress).toEqual({ answered: 1, total: 1, percent: 100 });

    component.onAnswers({ business_name: 'X', has_offer: true });
    expect(component.progress).toEqual({ answered: 1, total: 2, percent: 50 });
  });

  it('saves progress, sending a null for every answer that was cleared', () => {
    render(state({ answers: { business_name: 'Old', has_offer: false } }));
    studio.saveAnswers.and.returnValue(of(state({ answers: { business_name: 'New' } })));
    const component = fixture.componentInstance;

    component.onAnswers({ business_name: 'New' });
    expect(component.dirty).toBeTrue();
    component.save();

    expect(studio.saveAnswers).toHaveBeenCalledWith({ business_name: 'New', has_offer: null });
    expect(notify.success).toHaveBeenCalledWith('Progress saved.');
    expect(component.dirty).toBeFalse();
  });

  it('does not call the server when nothing has changed', () => {
    render(state());

    fixture.componentInstance.save();

    expect(studio.saveAnswers).not.toHaveBeenCalled();
  });

  it('will not complete while an asked, required question is unanswered, and says which', () => {
    const el = render(state());
    const component = fixture.componentInstance;

    component.onAnswers({ business_name: 'X', has_offer: true });
    fixture.detectChanges();
    component.complete();
    fixture.detectChanges();

    expect(studio.completeQuestionnaire).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
    expect(component.errors['offer']).toContain('needs an answer');
    expect(text(el.querySelector('[data-question="offer"] .error'))).toContain('needs an answer');
    expect(text(el.querySelector('[data-testid="missing"]'))).toContain('1 mandatory question still to answer');
  });

  it('clears a message the moment its problem is fixed', () => {
    render(state());
    const component = fixture.componentInstance;
    component.onAnswers({ business_name: 'X', has_offer: true });
    component.complete();
    expect(Object.keys(component.errors)).toEqual(['offer']);

    component.onAnswers({ business_name: 'X', has_offer: true, offer: '10% off' });

    expect(component.errors).toEqual({});
  });

  it('saves unsaved answers and then completes, and says what happened to the facts', () => {
    const el = render(state({ answers: { business_name: 'Old', has_offer: false } }));
    const done = state({ status: QuestionnaireResponseStatus.Completed, completedAtUtc: '2026-10-12T10:00:00Z', answers: { business_name: 'New', has_offer: false } });
    studio.saveAnswers.and.returnValue(of(state({ answers: { business_name: 'New', has_offer: false } })));
    studio.completeQuestionnaire.and.returnValue(of({ state: done, factsCreated: 3, factsUpdated: 1, factsRetired: 0 }));
    const component = fixture.componentInstance;

    component.onAnswers({ business_name: 'New', has_offer: false });
    component.complete();
    fixture.detectChanges();

    expect(studio.saveAnswers).toHaveBeenCalled();
    expect(studio.completeQuestionnaire).toHaveBeenCalled();
    expect(component.editable).toBeFalse();
    expect(text(el.querySelector('.notice'))).toContain('3 new and 1 changed fact(s)');
    expect(el.querySelector('.actions')).toBeNull();
  });

  it('shows a completed questionnaire read-only with a way to update it', () => {
    const el = render(state({ status: QuestionnaireResponseStatus.Completed, completedAtUtc: '2026-10-12T10:00:00Z' }));

    expect((el.querySelector('[data-question="business_name"] input') as HTMLInputElement).disabled).toBeTrue();
    expect(text(el)).toContain('Update my answers');
    expect(el.querySelector('.actions')).toBeNull();
  });

  it('offers the newer version, and restarting moves to it', () => {
    const el = render(state({ status: QuestionnaireResponseStatus.Completed, newerVersionAvailable: true }));
    expect(text(el.querySelector('.notice--warn'))).toContain('newer version');

    studio.restartQuestionnaire.and.returnValue(of(state({ versionNumber: 2 })));
    fixture.componentInstance.restart();
    fixture.detectChanges();

    expect(studio.restartQuestionnaire).toHaveBeenCalled();
    expect(fixture.componentInstance.state?.versionNumber).toBe(2);
    expect(fixture.componentInstance.editable).toBeTrue();
  });

  // ----- one small group at a time ------------------------------------------------------------------------------------------------

  describe('the steps', () => {
    it('asks one group of related questions at a time, with an example and a plain explanation', () => {
      const el = render(stepped({ business_name: 'Sunrise Clinic' }));

      expect(el.querySelectorAll('.step').length).toBe(3);
      expect(text(el.querySelector('.step-title'))).toContain('step 2 of 3'); // resumes at the first unfinished step
    });

    it('opens on the first step with a mandatory question still open, so coming back later picks up where they stopped', () => {
      const el = render(stepped({ business_name: 'Sunrise Clinic' }));

      expect(fixture.componentInstance.stepIndex).toBe(1);
      expect(el.querySelector('[data-question="audience"]')).not.toBeNull();
      expect(el.querySelector('[data-question="business_name"]')).toBeNull();
      expect(el.querySelector('[data-question="brand"]')).toBeNull();
    });

    it('opens on the first step when nothing is answered, with its help text and example', () => {
      const el = render(stepped());

      expect(fixture.componentInstance.stepIndex).toBe(0);
      expect(text(el.querySelector('[data-question="business_name"]'))).toContain('What customers call you.');
      expect(text(el.querySelector('[data-question="business_name"] .example'))).toContain('Sunrise Clinic');
    });

    it('moves forward and back, and any step can be opened to correct an answer', () => {
      const el = render(stepped());
      studio.saveAnswers.and.returnValue(of(stepped()));

      click('.actions button.mat-mdc-unelevated-button'); // Next
      expect(el.querySelector('[data-question="audience"]')).not.toBeNull();

      click('.step:nth-child(1)');
      expect(el.querySelector('[data-question="business_name"]')).not.toBeNull();

      const buttons = Array.from(el.querySelectorAll('.actions button')).map((b) => text(b));
      expect(buttons).not.toContain('Back'); // already on the first step
    });

    it('shows the last step with Complete rather than Next, and a Back button', () => {
      const el = render(stepped());
      fixture.componentInstance.go(2);
      fixture.detectChanges();

      const buttons = Array.from(el.querySelectorAll('.actions button')).map((b) => text(b));
      expect(buttons).toContain('Back');
      expect(buttons).toContain('Complete questionnaire');
      expect(buttons).not.toContain('Next');
    });

    it('marks a step done once its mandatory questions are answered', () => {
      const el = render(stepped({ business_name: 'Sunrise Clinic' }));

      expect(el.querySelector('.step:nth-child(1)')?.classList).toContain('step--done');
      expect(el.querySelector('.step:nth-child(2)')?.classList).not.toContain('step--done');
    });

    it('lists the mandatory questions still unanswered on the last step, and a click goes to the question', fakeAsync(() => {
      const el = render(stepped());
      fixture.componentInstance.go(2);
      fixture.detectChanges();

      const missing = el.querySelector('[data-testid="missing"]');
      expect(text(missing)).toContain('2 mandatory questions still to answer');
      expect(text(missing)).toContain('Name?');
      expect(text(missing)).toContain('Who are your customers?');

      (missing!.querySelectorAll('button')[1] as HTMLElement).click();
      fixture.detectChanges();
      flush();
      discardPeriodicTasks();

      expect(fixture.componentInstance.stepIndex).toBe(1);
      expect(el.querySelector('[data-question="audience"]')).not.toBeNull();
    }));

    it('jumps to the first unanswered mandatory question when completing is attempted', fakeAsync(() => {
      render(stepped({ audience: 'Adults' }));
      fixture.componentInstance.go(2);

      fixture.componentInstance.complete();
      fixture.detectChanges();
      flush();
      discardPeriodicTasks();

      expect(studio.completeQuestionnaire).not.toHaveBeenCalled();
      expect(fixture.componentInstance.stepIndex).toBe(0);
    }));

    it('does not show steps for a one-group questionnaire', () => {
      const el = render(state());

      expect(el.querySelector('.steps')).toBeNull();
      expect(text(el.querySelector('.actions'))).toContain('Complete questionnaire');
    });

    it('shows every question once completed, as a summary', () => {
      const el = render(state({ definition: STEPPED, status: QuestionnaireResponseStatus.Completed, answers: { business_name: 'A', audience: 'B' } }));

      expect(el.querySelectorAll('[data-question]').length).toBe(3);
      expect(el.querySelector('.steps')).toBeNull();
    });
  });

  // ----- saving by itself -----------------------------------------------------------------------------------------------------------

  describe('autosave', () => {
    it('saves a moment after the last change, without a toast, and says so', fakeAsync(() => {
      const el = render(stepped());
      studio.saveAnswers.and.returnValue(of(stepped({ business_name: 'Sunrise Clinic' })));

      fixture.componentInstance.onAnswers({ business_name: 'Sunrise Clinic' });
      fixture.detectChanges();
      expect(text(el.querySelector('[data-testid="save-status"]'))).toContain('Saving in a moment');

      tick(AUTOSAVE_DELAY_MS - 1);
      expect(studio.saveAnswers).not.toHaveBeenCalled();

      tick(1);
      fixture.detectChanges();

      expect(studio.saveAnswers).toHaveBeenCalledOnceWith({ business_name: 'Sunrise Clinic' });
      expect(notify.success).not.toHaveBeenCalled();
      expect(text(el.querySelector('[data-testid="save-status"]'))).toContain('All changes saved');
      expect(fixture.componentInstance.dirty).toBeFalse();
      flush();
      discardPeriodicTasks();
    }));

    it('waits for typing to stop: many quick changes make one save', fakeAsync(() => {
      render(stepped());
      studio.saveAnswers.and.returnValue(of(stepped({ business_name: 'Sunrise' })));
      const component = fixture.componentInstance;

      component.onAnswers({ business_name: 'S' });
      tick(500);
      component.onAnswers({ business_name: 'Su' });
      tick(500);
      component.onAnswers({ business_name: 'Sunrise' });
      tick(AUTOSAVE_DELAY_MS);

      expect(studio.saveAnswers).toHaveBeenCalledTimes(1);
      expect(studio.saveAnswers).toHaveBeenCalledWith({ business_name: 'Sunrise' });
      flush();
      discardPeriodicTasks();
    }));

    it('never overwrites what the tenant typed while a save was on its way, and saves that next', fakeAsync(() => {
      render(stepped());
      const inFlight = new Subject<QuestionnaireState>();
      studio.saveAnswers.and.returnValues(inFlight, of(stepped({ business_name: 'Sunrise Clinic' })));
      const component = fixture.componentInstance;

      component.onAnswers({ business_name: 'Sunrise' });
      tick(AUTOSAVE_DELAY_MS);
      expect(studio.saveAnswers).toHaveBeenCalledTimes(1);

      component.onAnswers({ business_name: 'Sunrise Clinic' }); // typed while the first save is still travelling
      inFlight.next(stepped({ business_name: 'Sunrise' })); // the server answers with the older text
      inFlight.complete();
      tick();

      expect(component.answers['business_name']).toBe('Sunrise Clinic');
      expect(studio.saveAnswers).toHaveBeenCalledTimes(2);
      expect(studio.saveAnswers.calls.mostRecent().args[0]).toEqual({ business_name: 'Sunrise Clinic' });
      flush();
      discardPeriodicTasks();
    }));

    it('keeps the answers and says so when a save fails', fakeAsync(() => {
      const el = render(stepped());
      const failing = new Subject<QuestionnaireState>();
      studio.saveAnswers.and.returnValue(failing);
      const component = fixture.componentInstance;

      component.onAnswers({ business_name: 'Sunrise' });
      tick(AUTOSAVE_DELAY_MS);
      failing.error(new Error('offline'));
      fixture.detectChanges();

      expect(component.dirty).toBeTrue();
      expect(component.answers['business_name']).toBe('Sunrise');
      expect(text(el.querySelector('[data-testid="save-status"]'))).toContain("Couldn't save");
      flush();
      discardPeriodicTasks();
    }));

    it('saves straight away when moving to another step instead of waiting for the timer', fakeAsync(() => {
      render(stepped());
      studio.saveAnswers.and.returnValue(of(stepped({ business_name: 'Sunrise' })));
      const component = fixture.componentInstance;

      component.onAnswers({ business_name: 'Sunrise' });
      component.next();

      expect(studio.saveAnswers).toHaveBeenCalledOnceWith({ business_name: 'Sunrise' });
      flush();
      discardPeriodicTasks();
    }));

    it('sends anything unsaved when the tenant leaves the page', fakeAsync(() => {
      render(stepped());
      studio.saveAnswers.and.returnValue(of(stepped({ business_name: 'Sunrise' })));

      fixture.componentInstance.onAnswers({ business_name: 'Sunrise' });
      fixture.destroy();

      expect(studio.saveAnswers).toHaveBeenCalledWith({ business_name: 'Sunrise' });
      flush();
      discardPeriodicTasks();
    }));
  });

  // ----- not forcing people to invent answers -------------------------------------------------------------------------------------------

  describe('"I don\'t know"', () => {
    it('offers I-don\'t-know, I-need-help and Not-applicable on a question, but not on one that needs a real answer', () => {
      const el = render(stepped());
      fixture.componentInstance.go(1);
      fixture.detectChanges();

      const options = Array.from(el.querySelectorAll('[data-question="audience"] [data-skip]')).map((b) => text(b));
      expect(options).toEqual(["I don't know", 'I need help with this', 'Not applicable']);

      fixture.componentInstance.go(0);
      fixture.detectChanges();
      expect(el.querySelector('[data-question="business_name"] [data-skip]')).toBeNull();
    });

    it('records the skip as the answer, which counts as answered and never blocks completing', fakeAsync(() => {
      const el = render(stepped({ business_name: 'Sunrise Clinic' }));
      studio.saveAnswers.and.returnValue(of(stepped({ business_name: 'Sunrise Clinic' })));
      const component = fixture.componentInstance;

      click('[data-question="audience"] [data-skip="unknown"]');

      expect(component.answers['audience']).toEqual({ $special: 'unknown' } as never);
      expect(text(el.querySelector('[data-question="audience"] .skipped'))).toContain("I don't know");
      expect(component.progress).toEqual({ answered: 2, total: 2, percent: 100 });
      expect(component.skippedCount).toBe(1);
      expect(text(el.querySelector('.skipped-note'))).toContain('marked 1 question as unknown');
      expect(el.querySelector('[data-question="audience"] textarea')).toBeNull();
      flush();
      discardPeriodicTasks();
    }));

    it('lets the tenant change their mind and answer after all', fakeAsync(() => {
      const el = render(stepped({ business_name: 'Sunrise Clinic', audience: { $special: 'need_help' } as never }));
      fixture.componentInstance.go(1);
      fixture.detectChanges();

      expect(text(el.querySelector('[data-question="audience"] .skipped'))).toContain('I need help with this');
      click('[data-question="audience"] .skipped button');

      expect(el.querySelector('[data-question="audience"] textarea')).not.toBeNull();
      expect(fixture.componentInstance.answers['audience']).toBeUndefined();
      flush();
      discardPeriodicTasks();
    }));

    it('does not count "not applicable" as something the studio must follow up', () => {
      render(stepped({ audience: { $special: 'not_applicable' } as never }));

      expect(fixture.componentInstance.skippedCount).toBe(0);
    });

    it('does not offer the skips on a completed, read-only questionnaire', () => {
      const el = render(state({ definition: STEPPED, status: QuestionnaireResponseStatus.Completed, answers: { business_name: 'A', audience: 'B' } }));

      expect(el.querySelector('[data-skip]')).toBeNull();
    });
  });

  // ----- history ----------------------------------------------------------------------------------------------------------------------

  describe('answer history', () => {
    const revision = (over: Partial<AnswerRevision>): AnswerRevision => ({
      id: 'a',
      questionKey: 'business_name',
      kind: 'Changed',
      previous: 'Old Name',
      new: 'New Name',
      changedBy: 'u1',
      changedByName: 'Asha Rao',
      changedAtUtc: '2026-10-17T09:00:00Z',
      ...over,
    });

    it('stays closed until asked for, then loads who changed what in place', () => {
      const el = render(state());
      studio.getAnswerHistory.and.returnValue(
        of([
          revision({}),
          revision({ id: 'b', kind: 'Cleared', previous: 'Old Name', new: null }),
          revision({ id: 'c', kind: 'Set', previous: null, new: { $special: 'unknown' }, questionKey: 'offer' }),
        ])
      );
      expect(studio.getAnswerHistory).not.toHaveBeenCalled();

      click('.history-toggle');

      expect(studio.getAnswerHistory).toHaveBeenCalled();
      const rows = Array.from(el.querySelectorAll('.history-list li')).map((li) => text(li));
      expect(rows[0]).toContain('Name?');
      expect(rows[0]).toContain('changed from "Old Name" to "New Name"');
      expect(rows[0]).toContain('Asha Rao');
      expect(rows[1]).toContain('cleared (was "Old Name")');
      expect(rows[2]).toContain('answered "I don\'t know"');
    });

    it('says so when nothing has changed yet', () => {
      const el = render(state());

      click('.history-toggle');

      expect(text(el.querySelector('.history'))).toContain('Nothing has been changed yet.');
    });
  });
});

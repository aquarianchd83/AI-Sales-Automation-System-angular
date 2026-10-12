import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { QuestionnaireDefinition, QuestionnaireResponseStatus, QuestionnaireState } from '../../../core/models/content-studio.model';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { StudioQuestionnaireComponent } from './studio-questionnaire.component';

const DEFINITION: QuestionnaireDefinition = {
  questions: [
    { key: 'business_name', type: 'ShortText', prompt: 'Name?', required: true },
    { key: 'has_offer', type: 'Boolean', prompt: 'Offer?' },
    { key: 'offer', type: 'ShortText', prompt: 'What offer?', required: true, showWhen: { questionKey: 'has_offer', operator: 'Equal', value: true } },
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

describe('StudioQuestionnaireComponent', () => {
  let fixture: ComponentFixture<StudioQuestionnaireComponent>;
  let studio: jasmine.SpyObj<ContentStudioService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(initial: QuestionnaireState): HTMLElement {
    studio = jasmine.createSpyObj('ContentStudioService', ['getQuestionnaire', 'saveAnswers', 'completeQuestionnaire', 'restartQuestionnaire']);
    studio.getQuestionnaire.and.returnValue(of(initial));
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
});

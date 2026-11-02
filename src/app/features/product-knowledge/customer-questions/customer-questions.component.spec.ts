import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { QualificationField } from '../../../core/models/qualification.model';
import { NotificationService } from '../../../core/services/notification.service';
import { QualificationService } from '../../../core/services/qualification.service';
import { SharedModule } from '../../../shared/shared.module';
import { CustomerQuestionsComponent } from './customer-questions.component';

describe('CustomerQuestionsComponent', () => {
  let service: jasmine.SpyObj<QualificationService>;
  let fixture: ComponentFixture<CustomerQuestionsComponent>;
  let notify: jasmine.SpyObj<NotificationService>;

  const field = (over: Partial<QualificationField>): QualificationField => ({
    id: 'f', fieldKey: 'k', displayName: 'Name', description: null, question: 'Q?', dataType: 'Text', isRequired: false, priority: 50,
    scoreWeight: 0, allowedValues: null, validationPattern: null, isActive: true, sortOrder: 0, createdAt: '2026-10-01T00:00:00Z',
    updatedAt: null, capturedLeadCount: 0, ...over,
  });

  beforeEach(() => {
    service = jasmine.createSpyObj<QualificationService>('QualificationService', ['list', 'getNextStep', 'setNextStep', 'setActive', 'delete', 'seedDefaults']);
    service.list.and.returnValue(
      of([
        field({ id: 'a', fieldKey: 'a', displayName: 'Low', priority: 10 }),
        field({ id: 'b', fieldKey: 'b', displayName: 'High', priority: 90 }),
        field({ id: 'c', fieldKey: 'c', displayName: 'Required', priority: 1, isRequired: true }),
      ])
    );
    service.getNextStep.and.returnValue(of({ goal: 'Enquiry', detail: null }));
    notify = jasmine.createSpyObj('NotificationService', ['success']);

    TestBed.configureTestingModule({
      declarations: [CustomerQuestionsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: QualificationService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(CustomerQuestionsComponent);
    fixture.detectChanges();
  });

  it('lists questions in the order the AI asks them: required, then most important', () => {
    expect(fixture.componentInstance.fields.map((f) => f.displayName)).toEqual(['Required', 'High', 'Low']);
  });

  it('shows no detail box while nothing is offered, and one once a step is chosen', () => {
    const c = fixture.componentInstance;
    expect(c.offersNextStep).toBeFalse();
    expect(fixture.nativeElement.querySelector('.next-step-detail')).toBeNull();

    c.nextStepForm.controls.goal.setValue('Demo');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.next-step-detail')).not.toBeNull();
  });

  it('saves the chosen step with its details, and drops the details when nothing is offered', () => {
    service.setNextStep.and.callFake((goal: string, detail: string | null) => of({ goal, detail }));
    const c = fixture.componentInstance;

    c.nextStepForm.setValue({ goal: 'Demo', detail: ' Free 30-minute demo on Zoom ' });
    c.saveNextStep();
    expect(service.setNextStep).toHaveBeenCalledWith('Demo', 'Free 30-minute demo on Zoom');

    c.nextStepForm.setValue({ goal: 'Enquiry', detail: 'left over' });
    c.saveNextStep();
    expect(service.setNextStep).toHaveBeenCalledWith('Enquiry', null);
  });

  it('refuses to save details that are too long', () => {
    const c = fixture.componentInstance;
    c.nextStepForm.setValue({ goal: 'Demo', detail: 'x'.repeat(301) });
    c.saveNextStep();
    expect(service.setNextStep).not.toHaveBeenCalled();
  });
});

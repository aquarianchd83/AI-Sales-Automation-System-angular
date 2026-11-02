import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { QualificationField, parseChoices, suggestFieldKey } from '../../../core/models/qualification.model';
import { NotificationService } from '../../../core/services/notification.service';
import { QualificationService } from '../../../core/services/qualification.service';
import { SharedModule } from '../../../shared/shared.module';
import { CustomerQuestionDialogComponent, CustomerQuestionDialogData } from './customer-question-dialog.component';

describe('qualification model helpers', () => {
  it('suggests a snake_case key that starts with a letter', () => {
    expect(suggestFieldKey('Software you use today')).toBe('software_you_use_today');
    expect(suggestFieldKey('  2nd Office?! ')).toBe('nd_office');
  });

  it('parses choices one per line or comma separated, without blanks or repeats', () => {
    expect(parseChoices('Zoho\n tally ,Excel,,zoho')).toEqual(['Zoho', 'tally', 'Excel']);
  });
});

describe('CustomerQuestionDialogComponent', () => {
  let questions: jasmine.SpyObj<QualificationService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<CustomerQuestionDialogComponent, boolean>>;

  const setup = (data: CustomerQuestionDialogData): ComponentFixture<CustomerQuestionDialogComponent> => {
    questions = jasmine.createSpyObj<QualificationService>('QualificationService', ['create', 'update']);
    questions.create.and.returnValue(of({} as QualificationField));
    questions.update.and.returnValue(of({} as QualificationField));
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    TestBed.configureTestingModule({
      declarations: [CustomerQuestionDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: QualificationService, useValue: questions },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success']) },
      ],
    });
    const fixture = TestBed.createComponent(CustomerQuestionDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('fills the key from the name until the key is edited by hand', () => {
    const c = setup({ mode: 'create', nextSortOrder: 3 }).componentInstance;
    c.form.controls.displayName.setValue('Team size');
    c.onNameInput();
    expect(c.form.controls.fieldKey.value).toBe('team_size');

    c.form.controls.fieldKey.setValue('headcount');
    c.onKeyInput();
    c.form.controls.displayName.setValue('Number of staff');
    c.onNameInput();
    expect(c.form.controls.fieldKey.value).toBe('headcount');
  });

  it('refuses to save and sends nothing while the form is invalid', () => {
    const c = setup({ mode: 'create', nextSortOrder: 0 }).componentInstance;
    c.save();
    expect(questions.create).not.toHaveBeenCalled();
    expect(c.form.touched).toBeTrue();
  });

  it('needs choices for a list question and sends them once given', () => {
    const c = setup({ mode: 'create', nextSortOrder: 2 }).componentInstance;
    c.form.patchValue({
      displayName: 'Current software',
      fieldKey: 'current_software',
      question: 'Which software do you use today?',
      dataType: 'SingleChoice',
    });
    expect(c.form.hasError('choicesRequired')).toBeTrue();
    c.save();
    expect(questions.create).not.toHaveBeenCalled();

    c.form.patchValue({ choices: 'Zoho\nTally\nNone' });
    c.save();
    expect(questions.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ fieldKey: 'current_software', allowedValues: ['Zoho', 'Tally', 'None'], sortOrder: 2 })
    );
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('keeps the key fixed when editing and does not resend it', () => {
    const field = {
      id: 'f1', fieldKey: 'budget', displayName: 'Budget', description: null, question: 'What budget?', dataType: 'Currency',
      isRequired: false, priority: 80, scoreWeight: 10, allowedValues: null, validationPattern: null, isActive: true,
      sortOrder: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: null, capturedLeadCount: 4,
    } as QualificationField;
    const c = setup({ mode: 'edit', field, nextSortOrder: 9 }).componentInstance;
    expect(c.form.controls.fieldKey.disabled).toBeTrue();

    c.form.patchValue({ question: 'Roughly what budget do you have?' });
    c.save();
    expect(questions.update).toHaveBeenCalledWith('f1', jasmine.objectContaining({ scoreWeight: 10, sortOrder: 1, priority: 80 }));
    expect(questions.update.calls.mostRecent().args[1]).not.toEqual(jasmine.objectContaining({ fieldKey: 'budget' }));
  });
});

import { TestBed } from '@angular/core/testing';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TagService } from '../../../core/services/tag.service';
import { SharedModule } from '../../../shared/shared.module';
import { CustomerFormDialogComponent } from './customer-form-dialog.component';

describe('CustomerFormDialogComponent tags', () => {
  const create = () => {
    const tags = jasmine.createSpyObj('TagService', ['getPaged']);
    tags.getPaged.and.returnValue(of({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 }));

    TestBed.configureTestingModule({
      declarations: [CustomerFormDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { mode: 'create' } },
        { provide: MatDialogRef, useValue: jasmine.createSpyObj('MatDialogRef', ['close']) },
        { provide: CustomerService, useValue: jasmine.createSpyObj('CustomerService', ['create', 'update', 'addTags', 'removeTag']) },
        { provide: TagService, useValue: tags },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']) },
      ],
    });
    const fixture = TestBed.createComponent(CustomerFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  const pick = (name: string) =>
    ({ option: { value: { id: 't1', name, customerCount: 3, createdAt: '' } } }) as MatAutocompleteSelectedEvent;

  it('clears what was typed once an existing tag is picked, so the next tag does not append to it', () => {
    const fixture = create();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input[placeholder^="Type to search existing tags"]') as HTMLInputElement;
    input.value = 'VI';
    input.dispatchEvent(new Event('input'));

    fixture.componentInstance.onTagOptionSelected(pick('VIP-Gold'));

    expect(input.value).toBe('');
    expect(fixture.componentInstance.newTags).toEqual(['VIP-Gold']);
  });

  it('does not stage the same picked tag twice', () => {
    const fixture = create();

    fixture.componentInstance.onTagOptionSelected(pick('VIP'));
    fixture.componentInstance.onTagOptionSelected(pick('VIP'));

    expect(fixture.componentInstance.newTags).toEqual(['VIP']);
  });
});

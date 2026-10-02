import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { BulkAddCustomerTagsResult } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TagService } from '../../../core/services/tag.service';
import { SharedModule } from '../../../shared/shared.module';
import { CustomerBulkTagDialogComponent } from './customer-bulk-tag-dialog.component';

describe('CustomerBulkTagDialogComponent', () => {
  let customers: jasmine.SpyObj<CustomerService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<CustomerBulkTagDialogComponent, boolean>>;

  const create = (ids = ['c1', 'c2', 'c3']) => {
    customers = jasmine.createSpyObj('CustomerService', ['bulkAddTags']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    const tags = jasmine.createSpyObj('TagService', ['getPaged']);
    tags.getPaged.and.returnValue(of({ items: [], page: 1, pageSize: 10, totalCount: 0 }));

    TestBed.configureTestingModule({
      declarations: [CustomerBulkTagDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { ids } },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CustomerService, useValue: customers },
        { provide: TagService, useValue: tags },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const fixture = TestBed.createComponent(CustomerBulkTagDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  const result = (over: Partial<BulkAddCustomerTagsResult> = {}): BulkAddCustomerTagsResult => ({
    requestedCount: 3,
    updatedCount: 3,
    notFoundIds: [],
    tagNames: ['VIP'],
    ...over,
  });

  it('names how many customers will be tagged', () => {
    const fixture = create();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Add tags to 3 customers');
  });

  it('cannot be saved until a tag is chosen', () => {
    const fixture = create();
    expect(fixture.componentInstance.canSave).toBeFalse();

    fixture.componentInstance.tagSearchControl.setValue('VIP');
    expect(fixture.componentInstance.canSave).toBeTrue();
  });

  it('sends every selected id with the chosen tags, once, and closes with true', () => {
    const fixture = create(['c1', 'c2']);
    customers.bulkAddTags.and.returnValue(of(result({ requestedCount: 2, updatedCount: 2 })));
    fixture.componentInstance.tagSearchControl.setValue('VIP');

    fixture.componentInstance.save();

    expect(customers.bulkAddTags).toHaveBeenCalledOnceWith(['c1', 'c2'], ['VIP']);
    expect(notify.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('keeps a tag that was typed but not committed with Enter', () => {
    const fixture = create();
    customers.bulkAddTags.and.returnValue(of(result({ tagNames: ['October'] })));
    fixture.componentInstance.tagSearchControl.setValue('  October ');

    fixture.componentInstance.save();

    expect(customers.bulkAddTags).toHaveBeenCalledWith(jasmine.any(Array), ['October']);
  });

  it('does not add the same tag twice, whatever its casing', () => {
    const fixture = create();
    customers.bulkAddTags.and.returnValue(of(result()));
    fixture.componentInstance.tagNames = ['VIP'];
    fixture.componentInstance.tagSearchControl.setValue('vip');

    fixture.componentInstance.save();

    expect(customers.bulkAddTags).toHaveBeenCalledOnceWith(['c1', 'c2', 'c3'], ['VIP']);
  });

  it('refuses a tag over the length limit without calling the API', () => {
    const fixture = create();
    fixture.componentInstance.tagSearchControl.setValue('x'.repeat(101));

    fixture.componentInstance.save();

    expect(customers.bulkAddTags).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('reports a partial outcome as information, and stays open on an error', () => {
    const fixture = create();
    customers.bulkAddTags.and.returnValue(of(result({ updatedCount: 1, notFoundIds: ['c3'] })));
    fixture.componentInstance.tagSearchControl.setValue('VIP');

    fixture.componentInstance.save();

    expect(notify.info).toHaveBeenCalled();
    expect(notify.info.calls.mostRecent().args[0]).toContain('Tagged 1 of 3');
    expect(notify.info.calls.mostRecent().args[0]).toContain('1 already had it');
    expect(notify.info.calls.mostRecent().args[0]).toContain('1 no longer exists');
  });

  it('clears what was typed once an existing tag is picked, so the next tag does not append to it', () => {
    const fixture = create();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = 'VI';
    input.dispatchEvent(new Event('input'));

    fixture.componentInstance.onTagOptionSelected({
      option: { value: { id: 't1', name: 'VIP-Gold', customerCount: 3, createdAt: '' } },
    } as MatAutocompleteSelectedEvent);

    expect(input.value).toBe('');
    expect(fixture.componentInstance.tagNames).toEqual(['VIP-Gold']);
  });
});

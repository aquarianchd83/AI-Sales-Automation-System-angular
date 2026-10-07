import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OverlayContainer } from '@angular/cdk/overlay';
import { of, throwError } from 'rxjs';

import { Campaign } from '../../../core/models/campaign.model';
import { Customer } from '../../../core/models/customer.model';
import { MessageTemplate } from '../../../core/models/message-template.model';
import { PagedResult } from '../../../core/models/paged-result.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { CustomerService } from '../../../core/services/customer.service';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TagService } from '../../../core/services/tag.service';
import { SharedModule } from '../../../shared/shared.module';
import { CampaignFormDialogComponent } from './campaign-form-dialog.component';

function page<T>(items: T[]): PagedResult<T> {
  return { items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 } as PagedResult<T>;
}

const template = (id: string, status: string, isActive = true) =>
  ({ id, name: `T-${id}`, language: 'en', bodyText: `Body ${id}`, whatsAppTemplateStatus: status, isActive }) as MessageTemplate;

const customer = { id: 'c1', firstName: 'Asha', lastName: 'Rao', phoneNumberE164: '+919800000001' } as Customer;

/** Creating a campaign asks for its first message and its audience in the same dialog - one with neither does nothing. */
describe('CampaignFormDialogComponent (create)', () => {
  let fixture: ComponentFixture<CampaignFormDialogComponent>;
  let overlay: OverlayContainer;
  let campaigns: jasmine.SpyObj<CampaignService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let close: jasmine.Spy;

  function open(templates: MessageTemplate[], customers: Customer[]): void {
    campaigns = jasmine.createSpyObj<CampaignService>('CampaignService', ['create', 'upsertStep', 'setAudience']);
    campaigns.create.and.returnValue(of({ id: 'camp-1' } as Campaign));
    campaigns.upsertStep.and.returnValue(of({ id: 'camp-1' } as Campaign));
    campaigns.setAudience.and.returnValue(of({ totalMatched: 1, addedCount: 1, alreadyAttachedCount: 0, notOptedInCount: 0 }));
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'error', 'info']);
    close = jasmine.createSpy('close');
    const templateService = jasmine.createSpyObj<MessageTemplateService>('MessageTemplateService', ['getPaged']);
    templateService.getPaged.and.returnValue(of(page(templates)));
    const customerService = jasmine.createSpyObj<CustomerService>('CustomerService', ['getPaged']);
    customerService.getPaged.and.returnValue(of(page(customers)));
    const tagService = jasmine.createSpyObj<TagService>('TagService', ['getPaged']);
    tagService.getPaged.and.returnValue(of(page([])));

    TestBed.configureTestingModule({
      declarations: [CampaignFormDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { mode: 'create' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: CampaignService, useValue: campaigns },
        { provide: NotificationService, useValue: notify },
        { provide: MessageTemplateService, useValue: templateService },
        { provide: CustomerService, useValue: customerService },
        { provide: TagService, useValue: tagService },
      ],
    });
    overlay = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(CampaignFormDialogComponent);
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
  }

  afterEach(() => overlay.ngOnDestroy());

  it('offers only approved, active templates', fakeAsync(() => {
    open([template('a', 'Approved'), template('p', 'Pending'), template('r', 'Rejected'), template('off', 'Approved', false)], [customer]);

    expect(fixture.componentInstance.templates.map((t) => t.id)).toEqual(['a']);
  }));

  it('says so, in place, when there is no approved template or no customer yet', fakeAsync(() => {
    open([template('p', 'Pending')], []);

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('No approved message template yet');
    expect(text).toContain('No customers yet');
    expect(fixture.componentInstance.canSave).toBeFalse();
  }));

  it('cannot be created until it has a name, a message and an audience', fakeAsync(() => {
    open([template('a', 'Approved')], [customer]);
    const c = fixture.componentInstance;

    c.form.patchValue({ name: 'Diwali offer' });
    expect(c.canSave).toBeFalse();
    c.form.patchValue({ messageTemplateId: 'a' });
    expect(c.canSave).toBeFalse(); // still nobody to send it to
    c.selectedTags = ['vip'];
    expect(c.canSave).toBeTrue();
  }));

  it('creates the campaign, then attaches its first message and its audience', fakeAsync(() => {
    open([template('a', 'Approved')], [customer]);
    const c = fixture.componentInstance;
    c.form.patchValue({ name: ' Diwali offer ', messageTemplateId: 'a' });
    c.selectedCustomers = [{ id: 'c1', label: 'Asha Rao' }];
    c.selectedTags = ['vip'];

    c.save();

    expect(campaigns.create).toHaveBeenCalledWith(jasmine.objectContaining({ name: 'Diwali offer' }));
    expect(campaigns.upsertStep).toHaveBeenCalledWith(
      'camp-1',
      jasmine.objectContaining({ stepType: 'Initial', delayDaysAfterPrevious: 0, messageTemplateId: 'a', isActive: true })
    );
    expect(campaigns.setAudience).toHaveBeenCalledWith('camp-1', { tagNames: ['vip'], customerIds: ['c1'] });
    expect(notify.success).toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(true);
  }));

  it('keeps the campaign as a draft and says what is missing when the audience cannot be attached', fakeAsync(() => {
    open([template('a', 'Approved')], [customer]);
    campaigns.setAudience.and.returnValue(throwError(() => new Error('x')));
    const c = fixture.componentInstance;
    c.form.patchValue({ name: 'Diwali offer', messageTemplateId: 'a' });
    c.selectedTags = ['vip'];

    c.save();

    expect(notify.error).toHaveBeenCalledWith(jasmine.stringMatching(/created as a draft/));
    expect(close).toHaveBeenCalledWith(true);
  }));
});

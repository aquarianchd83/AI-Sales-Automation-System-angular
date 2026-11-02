import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { Booking, BookingMessage, BookingStatus } from '../../../core/models/booking.model';
import { BookingService } from '../../../core/services/booking.service';
import { ConversationService } from '../../../core/services/conversation.service';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantProfileService } from '../../../core/services/tenant-profile.service';
import { SharedModule } from '../../../shared/shared.module';
import { BookingConversationPanelComponent } from '../booking-conversation-panel/booking-conversation-panel.component';
import { BookingListComponent } from './booking-list.component';

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  createdAtUtc: '2026-10-31T06:03:42Z',
  kind: 'Demo',
  summary: 'Demo on Mon 2 Nov at 4:00 PM IST; wants all topics covered.',
  customerName: 'Asha Verma',
  customerPhone: '+919000000001',
  conversationId: 'c1',
  isTest: false,
  status: 'Pending',
  newSlotUtc: null,
  ...over,
});

const pageOf = (items: Booking[]) => ({ items, totalCount: items.length, page: 1, pageSize: 10, totalPages: 1 });

describe('BookingListComponent', () => {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(items: Booking[] | 'fail' = [booking()]) {
    const api = {
      message: jasmine.createSpy('message').and.returnValue(of([{ channel: 'Email', status: 'Sent' }])),
      getPaged: jasmine.createSpy('getPaged').and.callFake(() => (items === 'fail' ? throwError(() => new Error('down')) : of(pageOf(items)))),
      setStatus: jasmine.createSpy('setStatus').and.callFake((id: string, status: BookingStatus) =>
        of({ ...(items === 'fail' ? booking() : items.find((b) => b.id === id)!), status })
      ),
    };
    const notify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    const conversations = {
      getById: jasmine.createSpy('getById').and.returnValue(
        of({ id: 'c1', customerName: 'Asha Verma', customerPhoneNumberE164: '+919000000001', status: 'Open', lastInboundMessageAt: new Date().toISOString() })
      ),
      getMessages: jasmine.createSpy('getMessages').and.returnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 30, totalPages: 0 })),
      sendMessage: jasmine.createSpy('sendMessage'),
    };
    TestBed.configureTestingModule({
      declarations: [BookingListComponent, BookingConversationPanelComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BookingService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: ConversationService, useValue: conversations },
        { provide: TenantProfileService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: MessageTemplateService, useValue: { getPaged: () => of({ items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 }) } },
      ],
    });
    const fixture = TestBed.createComponent(BookingListComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, api, notify, conversations };
  }

  /** A select shows the chosen option's label only once its options have initialised, a moment after the first render. */
  const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('lists each booking with who, what it is and what was agreed', () => {
    const { root } = render();

    const row = root.querySelector('tr.mat-mdc-row')!;
    expect(text(row)).toContain('Asha Verma');
    expect(text(row)).toContain('+919000000001');
    expect(text(row)).toContain('Demo');
    expect(text(row)).toContain('Demo on Mon 2 Nov at 4:00 PM IST; wants all topics covered.');
    expect(text(root.querySelector('[data-testid=count]'))).toBe('1 booking');
  });

  it('shows the phone number when there is no name, and a test booking as Test chat with no conversation actions', () => {
    const { root } = render([booking({ customerName: null }), booking({ id: 'b2', isTest: true, customerName: null, customerPhone: null, conversationId: null })]);

    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row'));
    expect(text(rows[0])).toContain('+919000000001');
    expect(text(rows[1].querySelector('[data-testid=test-chip]'))).toBe('Test chat');
    expect(rows[1].querySelector('[data-testid=message-button]')).toBeNull();
    expect(rows[1].querySelector('[data-testid=conversation-link]')).toBeNull();
  });

  // ----- the conversation link and the panel -----------------------------------------------------------------------------------------------

  it('has a link to the conversation on every booking that came from one', () => {
    const { root } = render();

    const link = root.querySelector('[data-testid=conversation-link]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/conversations/c1');
    expect(link.getAttribute('aria-label')).toBe('Open the conversation');
  });

  it('opens the conversation in a panel beside the list, with the booking as its context, without leaving the page', () => {
    const { root, fixture, conversations } = render();
    expect(root.querySelector('[data-testid=conversation-panel]')).toBeNull();

    (root.querySelector('[data-testid=message-button]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(conversations.getById).toHaveBeenCalledWith('c1');
    expect(root.querySelector('[data-testid=conversation-panel]')).not.toBeNull();
    expect(text(root.querySelector('[data-testid=context]'))).toBe('Demo: Demo on Mon 2 Nov at 4:00 PM IST; wants all topics covered.');
    expect(root.querySelector('[data-testid=layout]')?.classList).toContain('layout--with-panel');
    expect(root.querySelector('[data-testid=bookings-table]')).not.toBeNull(); // the list is still there
    expect(root.querySelector('tr.row-selected')).not.toBeNull();
  });

  it('closes the panel again', () => {
    const { root, fixture } = render();
    (root.querySelector('[data-testid=message-button]') as HTMLButtonElement).click();
    fixture.detectChanges();

    (root.querySelector('[data-testid=close-panel]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid=conversation-panel]')).toBeNull();
    expect(root.querySelector('[data-testid=layout]')?.classList).not.toContain('layout--with-panel');
  });

  it('switches the panel to another booking\'s conversation', () => {
    const { root, fixture, conversations } = render([booking(), booking({ id: 'b2', conversationId: 'c2', customerName: 'Ravi Kumar' })]);
    const buttons = () => Array.from(root.querySelectorAll('[data-testid=message-button]')) as HTMLButtonElement[];

    buttons()[0].click();
    fixture.detectChanges();
    buttons()[1].click();
    fixture.detectChanges();

    expect(conversations.getById.calls.allArgs().map((a) => a[0])).toEqual(['c1', 'c2']);
  });

  // ----- status --------------------------------------------------------------------------------------------------------------------------------

  it('shows each booking\'s status in a control with Pending, Done and Reschedule', async () => {
    const { root, fixture } = render([booking({ status: 'Reschedule' })]);
    await settle(fixture);

    const select = root.querySelector('[data-testid=status-select]') as HTMLElement;
    expect(text(select)).toBe('Reschedule');
    select.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
    await settle(fixture);
    const options = Array.from(document.querySelectorAll('mat-option')).map((o) => text(o));
    expect(options).toEqual(['Pending', 'Done', 'Reschedule']);
  });

  it('changes the status from the control, saves it and shows it without reloading the list', async () => {
    const { root, fixture, api, notify } = render();
    await settle(fixture);
    const loads = api.getPaged.calls.count();

    (root.querySelector('[data-testid=status-select] .mat-mdc-select-trigger') as HTMLElement).click();
    await settle(fixture);
    const done = Array.from(document.querySelectorAll('mat-option')).find((o) => text(o) === 'Done') as HTMLElement;
    done.click();
    await settle(fixture);

    expect(api.setStatus).toHaveBeenCalledWith('b1', 'Done');
    expect(text(root.querySelector('[data-testid=status-select]'))).toBe('Done');
    expect(notify.success).toHaveBeenCalledWith('Demo marked Done.');
    expect(api.getPaged.calls.count()).toBe(loads);
  });

  it('does nothing when the status chosen is the one it already has', () => {
    const { fixture, api } = render([booking({ status: 'Done' })]);

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Done');

    expect(api.setStatus).not.toHaveBeenCalled();
  });

  it('keeps the old status when the change is refused', async () => {
    const { fixture, api, root } = render();
    api.setStatus.and.returnValue(throwError(() => new Error('nope')));

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Done');
    await settle(fixture);

    expect(text(root.querySelector('[data-testid=status-select]'))).toBe('Pending');
    expect(fixture.componentInstance.saving.size).toBe(0);
  });

  it('narrows the list by status, and asks the server for it', () => {
    const { root, fixture, api } = render();

    const toggles = Array.from(root.querySelectorAll('[data-testid=status-filter] button')) as HTMLButtonElement[];
    expect(toggles.map((t) => text(t))).toEqual(['All', 'Pending', 'Reschedule', 'Done']);
    toggles.find((t) => text(t) === 'Reschedule')!.click();
    fixture.detectChanges();

    expect(api.getPaged.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ status: 'Reschedule' }));
    expect(api.getPaged.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ page: 1 }));
  });

  it('drops a booking from a filtered list when its status no longer matches, by reading the list again', () => {
    const { fixture, api } = render([booking({ status: 'Reschedule' })]);
    fixture.componentInstance.setStatusFilter('Reschedule');
    const loads = api.getPaged.calls.count();

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Done');

    expect(api.getPaged.calls.count()).toBe(loads + 1);
  });

  it('closes the panel when its booking leaves the page', () => {
    const { fixture, api, root } = render([booking({ status: 'Reschedule' })]);
    fixture.componentInstance.setStatusFilter('Reschedule');
    fixture.componentInstance.openConversation(fixture.componentInstance.page.items[0]);
    fixture.detectChanges();
    expect(root.querySelector('[data-testid=conversation-panel]')).not.toBeNull();

    api.getPaged.and.returnValue(of(pageOf([])));
    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Done');
    fixture.detectChanges();

    expect(root.querySelector('[data-testid=conversation-panel]')).toBeNull();
  });

  // ----- rescheduling: picking a new slot -------------------------------------------------------------------------------------------------

  /** Stands in for the dialog: closes with what the test says, after running the save the dialog would run. */
  function stubDialog(result: 'cancel' | { slot: string | null; message?: BookingMessage | null }) {
    const dialog = TestBed.inject(MatDialog);
    return spyOn(dialog, 'open').and.callFake(((_: unknown, config: { data: { save: (s: string | null, reason: string, message: BookingMessage | null) => any } }) => ({
      afterClosed: () => {
        if (result === 'cancel') {
          return of(undefined);
        }
        let saved: unknown;
        config.data.save(result.slot, 'Customer asked', result.message ?? null).subscribe((b: unknown) => (saved = b));
        return of({ booking: saved });
      },
    })) as any);
  }

  it('opens the new-slot dialog instead of saving at once when Reschedule is chosen', () => {
    const { fixture, api } = render();
    const open = stubDialog('cancel');

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Reschedule');

    expect(open).toHaveBeenCalled();
    expect(api.setStatus).not.toHaveBeenCalled();
  });

  it('leaves the booking as it was when the dialog is cancelled, and the select shows the saved status again', async () => {
    const { fixture, root } = render();
    stubDialog('cancel');
    await settle(fixture);

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Reschedule');
    await settle(fixture);

    expect(text(root.querySelector('[data-testid=status-select]'))).toBe('Pending');
  });

  it('saves Reschedule with the picked slot, shows it in the row and says it was moved', async () => {
    const { fixture, api, root, notify } = render();
    api.setStatus.and.callFake((id: string, status: BookingStatus, slot?: string | null) =>
      of(booking({ id, status, newSlotUtc: slot ? '2099-11-04T05:30:00Z' : null }))
    );
    stubDialog({ slot: '2099-11-04T11:00' });

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Reschedule');
    await settle(fixture);

    expect(api.setStatus).toHaveBeenCalledWith('b1', 'Reschedule', '2099-11-04T11:00', 'Customer asked', null);
    expect(text(root.querySelector('[data-testid=new-slot]'))).toContain('New time:');
    expect(text(root.querySelector('[data-testid=new-slot]'))).toContain('11:00');
    expect(text(root.querySelector('[data-testid=change-time]'))).toBe('Change time');
    expect(notify.success).toHaveBeenCalledWith(jasmine.stringContaining('Demo moved to'));
    expect(root.querySelector('[data-testid=conversation-panel]')).toBeNull();
  });

  it('can reschedule without a time, and offers to pick one later', async () => {
    const { fixture, api, root, notify } = render();
    api.setStatus.and.callFake((id: string, status: BookingStatus) => of(booking({ id, status })));
    stubDialog({ slot: null });

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Reschedule');
    await settle(fixture);

    expect(api.setStatus).toHaveBeenCalledWith('b1', 'Reschedule', null, 'Customer asked', null);
    expect(text(root.querySelector('[data-testid=new-slot]'))).toContain('New time not picked yet');
    expect(text(root.querySelector('[data-testid=change-time]'))).toBe('Pick a time');
    expect(notify.success).toHaveBeenCalledWith('Demo marked Reschedule.');
  });

  it('sends the message with the reschedule and says how it went', async () => {
    const { fixture, api, notify } = render();
    const message: BookingMessage = { text: 'Moved to 11:00. Zoom: https://zoom.example/abc', sendEmail: true, sendWhatsApp: true };
    api.setStatus.and.callFake((id: string, status: BookingStatus) =>
      of(booking({ id, status, newSlotUtc: '2099-11-04T05:30:00Z', messageResults: [{ channel: 'Email', status: 'Sent' }, { channel: 'WhatsApp', status: 'Sent' }] }))
    );
    stubDialog({ slot: '2099-11-04T11:00', message });

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Reschedule');
    await settle(fixture);

    expect(api.setStatus).toHaveBeenCalledWith('b1', 'Reschedule', '2099-11-04T11:00', 'Customer asked', message);
    expect(notify.success).toHaveBeenCalledWith(jasmine.stringContaining('Message sent by email and WhatsApp.'));
  });

  it('is plain when a message did not go: the booking is moved, and the team is told what to follow up', async () => {
    const { fixture, api, notify } = render();
    api.setStatus.and.callFake((id: string, status: BookingStatus) =>
      of(booking({ id, status, messageResults: [{ channel: 'WhatsApp', status: 'Failed', note: 'the 24-hour window is closed' }] }))
    );
    stubDialog({ slot: null, message: { text: 'Hello', sendEmail: false, sendWhatsApp: true } });

    fixture.componentInstance.changeStatus(fixture.componentInstance.page.items[0], 'Reschedule');
    await settle(fixture);

    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Demo marked Reschedule. WhatsApp not sent (the 24-hour window is closed).');
    expect(fixture.componentInstance.page.items[0].status).toBe('Reschedule');
  });

  it('sends details to the customer from the list without changing the booking', async () => {
    const { fixture, api, notify, root } = render([booking({ customerEmail: 'asha@example.com' })]);
    const message: BookingMessage = { text: 'Join: https://zoom.example/abc', sendEmail: true, sendWhatsApp: false };
    const open = spyOn(TestBed.inject(MatDialog), 'open').and.callFake(((_: unknown, config: { data: { send: (m: BookingMessage) => any } }) => ({
      afterClosed: () => {
        let results: unknown;
        config.data.send(message).subscribe((r: unknown) => (results = r));
        return of(results);
      },
    })) as any);
    await settle(fixture);

    (root.querySelector('[data-testid=send-details]') as HTMLButtonElement).click();

    expect(open).toHaveBeenCalled();
    expect(api.message).toHaveBeenCalledWith('b1', message);
    expect(api.setStatus).not.toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('Message sent by email.');
  });

  it('offers to send details only when there is a way to reach the customer', async () => {
    const { fixture, root } = render([booking({ id: 'a' }), booking({ id: 'b', conversationId: null, customerEmail: null })]);
    await settle(fixture);

    expect(root.querySelectorAll('[data-testid=send-details]').length).toBe(1);
  });

  it('does not offer to change the time of a booking that is not marked Reschedule', async () => {
    const { fixture, root } = render([booking({ status: 'Done' })]);
    await settle(fixture);

    expect(root.querySelector('[data-testid=change-time]')).toBeNull();
    expect(root.querySelector('[data-testid=new-slot]')).toBeNull();
  });

  it('opens the dialog again from Change time', async () => {
    const { fixture, root } = render([booking({ status: 'Reschedule', newSlotUtc: '2099-11-04T05:30:00Z' })]);
    const open = stubDialog('cancel');
    await settle(fixture);

    (root.querySelector('[data-testid=change-time]') as HTMLButtonElement).click();

    expect(open).toHaveBeenCalled();
  });

  // ----- the rest ------------------------------------------------------------------------------------------------------------------------------

  it('leaves test chat bookings out until asked, then asks again for them', () => {
    const { root, api, fixture } = render();

    expect(api.getPaged.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ includeTests: false }));

    (root.querySelector('[data-testid=include-tests] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.getPaged.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ includeTests: true }));
    expect(api.getPaged.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ page: 1 }));
  });

  it('says what to expect when there are none yet, and when a status has none', () => {
    const { root, fixture } = render([]);
    expect(text(root.querySelector('[data-testid=empty]'))).toContain('No demos scheduled yet');

    fixture.componentInstance.setStatusFilter('Done');
    fixture.detectChanges();
    expect(text(root.querySelector('[data-testid=empty]'))).toContain('No Done bookings.');
  });

  it('says so when the bookings could not be loaded', () => {
    const { root } = render('fail');

    expect(text(root.querySelector('[data-testid=failed]'))).toContain('could not be loaded');
  });
});

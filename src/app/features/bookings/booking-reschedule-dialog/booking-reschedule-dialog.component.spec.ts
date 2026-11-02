import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { Booking, rescheduleDraft, slotLocal, slotText } from '../../../core/models/booking.model';
import { SharedModule } from '../../../shared/shared.module';
import { BookingRescheduleDialogComponent } from './booking-reschedule-dialog.component';

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', createdAtUtc: '2026-10-31T06:03:42Z', kind: 'Demo', summary: 'Demo on Mon 2 Nov at 4:00 PM IST', customerName: 'Asha Verma',
  customerPhone: '+919000000001', conversationId: 'c1', isTest: false, status: 'Pending', newSlotUtc: null, ...over,
});

describe('BookingRescheduleDialogComponent', () => {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(over: { booking?: Booking; save?: jasmine.Spy } = {}) {
    const close = jasmine.createSpy('close');
    const save = over.save ?? jasmine.createSpy('save').and.callFake(() => of(booking({ status: 'Reschedule' })));
    TestBed.configureTestingModule({
      declarations: [BookingRescheduleDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { booking: over.booking ?? booking(), timezone: 'Asia/Kolkata', save } },
      ],
    });
    const fixture = TestBed.createComponent(BookingRescheduleDialogComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = () => root.querySelector('[data-testid=reschedule]') as HTMLButtonElement;
    return { fixture, root, close, save, button, c: fixture.componentInstance };
  }

  it('says whose booking it is and which time zone the time is read in', () => {
    const { root } = render();

    expect(text(root)).toContain('Reschedule the demo');
    expect(text(root)).toContain('Asha Verma');
    expect(text(root.querySelector('[data-testid=zone]'))).toContain('Asia/Kolkata');
  });

  it('reschedules without a time when none is picked', () => {
    const { fixture, button, save, close } = render();

    button().click();
    fixture.detectChanges();

    expect(save).toHaveBeenCalledWith(null);
    expect(close).toHaveBeenCalledWith({ booking: jasmine.objectContaining({ status: 'Reschedule' }), writeMessage: true });
  });

  it('sends the picked day and time as the tenant\'s clock reads them', () => {
    const { fixture, button, save, c } = render();

    c.form.patchValue({ date: new Date(2099, 10, 4), time: '11:00' });
    fixture.detectChanges();
    button().click();

    expect(save).toHaveBeenCalledWith('2099-11-04T11:00');
  });

  it('will not save half a time', () => {
    const { fixture, root, button, save, c } = render();

    c.form.patchValue({ date: new Date(2099, 10, 4) });
    fixture.detectChanges();

    expect(button().disabled).toBeTrue();
    expect(root.querySelector('[data-testid=incomplete]')).not.toBeNull();
    c.save();
    expect(save).not.toHaveBeenCalled();
  });

  it('only offers the customer message when the booking has a conversation, and passes the choice on', () => {
    const none = render({ booking: booking({ conversationId: null }) });
    expect(none.root.querySelector('[data-testid=write-message]')).toBeNull();
    none.button().click();
    expect(none.close).toHaveBeenCalledWith(jasmine.objectContaining({ writeMessage: false }));
    TestBed.resetTestingModule();

    const some = render();
    some.c.form.patchValue({ writeMessage: false });
    some.button().click();
    expect(some.close).toHaveBeenCalledWith(jasmine.objectContaining({ writeMessage: false }));
  });

  it('stays open when the save is refused, so another time can be picked', () => {
    const { fixture, button, close, c } = render({ save: jasmine.createSpy('save').and.returnValue(throwError(() => new Error('Pick a time in the future.'))) });

    button().click();
    fixture.detectChanges();

    expect(close).not.toHaveBeenCalled();
    expect(c.saving).toBeFalse();
  });
});

describe('booking slot helpers', () => {
  it('builds the local slot string the API reads', () => {
    expect(slotLocal(new Date(2099, 0, 5), '09:30')).toBe('2099-01-05T09:30');
  });

  it('writes a moment in the tenant\'s own zone', () => {
    const t = slotText('2099-11-04T05:30:00Z', 'Asia/Kolkata');
    expect(t).toContain('11:00');
    expect(t).toContain('4 Nov');
  });

  it('drafts a message proposing the time, or asking for one', () => {
    const b = { customerName: 'Asha Verma', kind: 'Demo' };
    expect(rescheduleDraft(b, '2099-11-04T05:30:00Z', 'Asia/Kolkata')).toContain('Hi Asha, we need to move your demo. Could we do');
    expect(rescheduleDraft(b, null, null)).toBe('Hi Asha, we need to move your demo. What day and time would suit you?');
    expect(rescheduleDraft({ customerName: null, kind: 'Site visit' }, null, null)).toBe('Hi, we need to move your site visit. What day and time would suit you?');
  });
});

import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { Booking, messageOutcome, rescheduleMessage, slotLabelLocal, slotLocal, slotText } from '../../../core/models/booking.model';
import { SharedModule } from '../../../shared/shared.module';
import { BookingRescheduleDialogComponent } from './booking-reschedule-dialog.component';

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', createdAtUtc: '2026-10-31T06:03:42Z', kind: 'Demo', summary: 'Demo on Mon 2 Nov at 4:00 PM IST', customerName: 'Asha Verma',
  customerPhone: '+919000000001', conversationId: 'c1', isTest: false, status: 'Pending', newSlotUtc: null, customerEmail: 'asha@example.com', ...over,
});

describe('BookingRescheduleDialogComponent', () => {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(over: { booking?: Booking; save?: jasmine.Spy; reason?: string } = {}) {
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
    fixture.componentInstance.form.patchValue({ reason: over.reason ?? 'Customer asked to move it' });
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

    expect(save).toHaveBeenCalledWith(null, 'Customer asked to move it', jasmine.objectContaining({ sendEmail: true, sendWhatsApp: true }));
    expect(close).toHaveBeenCalledWith({ booking: jasmine.objectContaining({ status: 'Reschedule' }) });
  });

  it('sends the picked day and time as the tenant\'s clock reads them', () => {
    const { fixture, button, save, c } = render();

    c.form.patchValue({ date: new Date(2099, 10, 4), time: '11:00' });
    fixture.detectChanges();
    button().click();

    expect(save).toHaveBeenCalledWith('2099-11-04T11:00', 'Customer asked to move it', jasmine.anything());
  });

  it('will not save without a reason, and a reason of spaces is not one', () => {
    const { fixture, root, button, save, c } = render({ reason: '' });

    expect(button().disabled).toBeTrue();
    c.save();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(text(root)).toContain('Say why the booking is being rescheduled.');

    c.form.patchValue({ reason: '   ' });
    fixture.detectChanges();
    expect(button().disabled).toBeTrue();
  });

  it('sends the reason trimmed', () => {
    const { button, save } = render({ reason: '  Customer is travelling  ' });

    button().click();

    expect(save).toHaveBeenCalledWith(null, 'Customer is travelling', jasmine.anything());
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

  it('offers a message to the customer, ready to read, and sends it with the reschedule', () => {
    const { fixture, button, save, c, root } = render();

    c.form.patchValue({ date: new Date(2099, 10, 4), time: '11:00' });
    fixture.detectChanges();

    const box = root.querySelector('[data-testid=message]') as HTMLTextAreaElement;
    expect(box.value).toContain('Hi Asha, your demo has been moved to');
    expect(box.value).toContain('11:00 am (Asia/Kolkata)');

    // The team adds the meeting link, which is theirs and is sent as written.
    c.form.controls.message.setValue(box.value + ' Join: https://zoom.example/abc');
    c.form.controls.message.markAsDirty();
    button().click();

    expect(save).toHaveBeenCalledWith('2099-11-04T11:00', 'Customer asked to move it', {
      text: jasmine.stringContaining('Join: https://zoom.example/abc') as unknown as string,
      sendEmail: true,
      sendWhatsApp: true,
    });
  });

  it('keeps what the team wrote when the time is changed afterwards', () => {
    const { fixture, c } = render();

    c.form.controls.message.setValue('My own words');
    c.form.controls.message.markAsDirty();
    c.form.patchValue({ date: new Date(2099, 10, 4), time: '11:00' });
    fixture.detectChanges();

    expect(c.form.controls.message.value).toBe('My own words');
  });

  it('sends by the channels chosen, and nothing when the box is cleared', () => {
    const emailOnly = render();
    emailOnly.c.form.patchValue({ sendWhatsApp: false });
    emailOnly.button().click();
    expect(emailOnly.save).toHaveBeenCalledWith(null, 'Customer asked to move it', jasmine.objectContaining({ sendEmail: true, sendWhatsApp: false }));
    TestBed.resetTestingModule();

    const cleared = render();
    cleared.c.form.patchValue({ message: '   ' });
    cleared.button().click();
    expect(cleared.save).toHaveBeenCalledWith(null, 'Customer asked to move it', null);
  });

  it('will not save a message with no channel ticked', () => {
    const { fixture, root, button, save, c } = render();

    c.form.patchValue({ sendEmail: false, sendWhatsApp: false });
    fixture.detectChanges();

    expect(button().disabled).toBeTrue();
    expect(root.querySelector('[data-testid=needs-channel]')).not.toBeNull();
    c.save();
    expect(save).not.toHaveBeenCalled();
  });

  it('switches off a channel that has nowhere to go, and says why', () => {
    const noEmail = render({ booking: booking({ customerEmail: null }) });
    expect(noEmail.c.form.controls.sendEmail.disabled).toBeTrue();
    expect(noEmail.root.querySelector('[data-testid=no-email]')).not.toBeNull();
    noEmail.button().click();
    expect(noEmail.save).toHaveBeenCalledWith(null, 'Customer asked to move it', jasmine.objectContaining({ sendEmail: false, sendWhatsApp: true }));
    TestBed.resetTestingModule();

    const testChat = render({ booking: booking({ conversationId: null }) });
    expect(testChat.c.form.controls.sendWhatsApp.disabled).toBeTrue();
    expect(testChat.root.querySelector('[data-testid=no-conversation]')).not.toBeNull();
    TestBed.resetTestingModule();

    const nowhere = render({ booking: booking({ conversationId: null, customerEmail: null }) });
    expect(nowhere.root.querySelector('[data-testid=message]')).toBeNull();
    expect(nowhere.root.querySelector('[data-testid=cannot-message]')).not.toBeNull();
    nowhere.button().click();
    expect(nowhere.save).toHaveBeenCalledWith(null, 'Customer asked to move it', null);
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

  it('words the reschedule message with the time, or asks for one', () => {
    const b = { customerName: 'Asha Verma', kind: 'Demo' };
    expect(rescheduleMessage(b, 'Wed, 4 Nov at 11:00 am')).toContain('Hi Asha, your demo has been moved to Wed, 4 Nov at 11:00 am.');
    expect(rescheduleMessage(b, 'x')).toContain('We will share the joining details here.');
    expect(rescheduleMessage(b, null)).toBe('Hi Asha, we need to move your demo. What day and time would suit you?');
    expect(rescheduleMessage({ customerName: null, kind: 'Site visit' }, null)).toBe('Hi, we need to move your site visit. What day and time would suit you?');
  });

  it('writes the picked time as the tenant\'s own clock', () => {
    expect(slotLabelLocal(new Date(2099, 10, 4), '11:00', 'Asia/Kolkata')).toContain('4 Nov');
    expect(slotLabelLocal(new Date(2099, 10, 4), '11:00', 'Asia/Kolkata')).toContain('at 11:00 am (Asia/Kolkata)');
    expect(slotLabelLocal(new Date(2099, 10, 4), '00:05', null)).toContain('at 12:05 am');
    expect(slotLabelLocal(new Date(2099, 10, 4), '15:30', null)).toContain('at 3:30 pm');
  });

  it('says in words what a message did, and what it did not', () => {
    expect(messageOutcome(null)).toEqual({ text: '', ok: true });
    expect(messageOutcome([{ channel: 'Email', status: 'Sent' }, { channel: 'WhatsApp', status: 'Sent' }])).toEqual({ text: 'Message sent by email and WhatsApp.', ok: true });
    const mixed = messageOutcome([{ channel: 'Email', status: 'Sent' }, { channel: 'WhatsApp', status: 'Failed', note: 'the 24-hour window is closed' }]);
    expect(mixed.ok).toBeFalse();
    expect(mixed.text).toBe('Message sent by email. WhatsApp not sent (the 24-hour window is closed).');
    expect(messageOutcome([{ channel: 'Email', status: 'Skipped', note: 'no SMTP host configured' }]).text).toBe('email not sent (no SMTP host configured).');
  });
});

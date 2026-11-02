import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { Booking, BookingMessageResult } from '../../../core/models/booking.model';
import { SharedModule } from '../../../shared/shared.module';
import { BookingMessageDialogComponent } from './booking-message-dialog.component';

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', createdAtUtc: '2026-10-31T06:03:42Z', kind: 'Demo', summary: 'Demo on Mon 2 Nov at 4:00 PM IST', customerName: 'Asha Verma',
  customerPhone: '+919000000001', conversationId: 'c1', isTest: false, status: 'Pending', newSlotUtc: null, customerEmail: 'asha@example.com', ...over,
});

describe('BookingMessageDialogComponent', () => {
  const results: BookingMessageResult[] = [{ channel: 'Email', status: 'Sent' }, { channel: 'WhatsApp', status: 'Sent' }];

  function render(over: { booking?: Booking; send?: jasmine.Spy } = {}) {
    const close = jasmine.createSpy('close');
    const send = over.send ?? jasmine.createSpy('send').and.returnValue(of(results));
    TestBed.configureTestingModule({
      declarations: [BookingMessageDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { booking: over.booking ?? booking(), send } },
      ],
    });
    const fixture = TestBed.createComponent(BookingMessageDialogComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = () => root.querySelector('[data-testid=send]') as HTMLButtonElement;
    return { fixture, root, close, send, button, c: fixture.componentInstance };
  }

  it('will not send an empty or blank message', () => {
    const { fixture, button, send, c } = render();

    expect(button().disabled).toBeTrue();
    c.form.patchValue({ text: '   ' });
    fixture.detectChanges();
    expect(button().disabled).toBeTrue();
    c.send();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the message trimmed by both channels and closes with how each went', () => {
    const { fixture, button, send, close, c } = render();

    c.form.patchValue({ text: '  Join: https://zoom.example/abc  ' });
    fixture.detectChanges();
    button().click();

    expect(send).toHaveBeenCalledWith({ text: 'Join: https://zoom.example/abc', sendEmail: true, sendWhatsApp: true });
    expect(close).toHaveBeenCalledWith(results);
  });

  it('sends only by the channel chosen, and will not send with none', () => {
    const { fixture, button, send, c } = render();

    c.form.patchValue({ text: 'Hello', sendWhatsApp: false });
    fixture.detectChanges();
    button().click();
    expect(send).toHaveBeenCalledWith({ text: 'Hello', sendEmail: true, sendWhatsApp: false });

    send.calls.reset();
    c.form.patchValue({ sendEmail: false });
    fixture.detectChanges();
    expect(button().disabled).toBeTrue();
    c.send();
    expect(send).not.toHaveBeenCalled();
  });

  it('switches off email when there is no address and WhatsApp when there is no conversation, saying why', () => {
    const noEmail = render({ booking: booking({ customerEmail: null }) });
    expect(noEmail.c.form.controls.sendEmail.disabled).toBeTrue();
    expect(noEmail.root.querySelector('[data-testid=no-email]')).not.toBeNull();
    noEmail.c.form.patchValue({ text: 'Hello' });
    noEmail.fixture.detectChanges();
    noEmail.button().click();
    expect(noEmail.send).toHaveBeenCalledWith({ text: 'Hello', sendEmail: false, sendWhatsApp: true });
    TestBed.resetTestingModule();

    const testChat = render({ booking: booking({ conversationId: null }) });
    expect(testChat.c.form.controls.sendWhatsApp.disabled).toBeTrue();
    expect(testChat.root.querySelector('[data-testid=no-conversation]')).not.toBeNull();
  });

  it('stays open when the request itself fails, so the message is not lost', () => {
    const { fixture, button, close, c } = render({ send: jasmine.createSpy('send').and.returnValue(throwError(() => new Error('down'))) });

    c.form.patchValue({ text: 'Hello' });
    fixture.detectChanges();
    button().click();

    expect(close).not.toHaveBeenCalled();
    expect(c.sending).toBeFalse();
    expect(c.form.controls.text.value).toBe('Hello');
  });
});

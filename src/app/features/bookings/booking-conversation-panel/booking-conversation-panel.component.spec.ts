import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { Conversation, ConversationMessage, MessageDirection, MessageStatus } from '../../../core/models/conversation.model';
import { WhatsAppTemplateStatus } from '../../../core/models/message-template.model';
import { ConversationService } from '../../../core/services/conversation.service';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { BookingConversationPanelComponent } from './booking-conversation-panel.component';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const conversation = (over: Partial<Conversation> = {}): Conversation =>
  ({
    id: 'c1', customerId: 'cu1', customerPhoneNumberE164: '+919000000001', customerName: 'Asha Verma', mode: 'AI', status: 'Open', assignedAgentId: null,
    lastMessageAt: hoursAgo(1), lastInboundMessageAt: hoursAgo(1), createdAt: hoursAgo(5), closedAt: null,
    aiConfidenceLast: null, lastDetectedIntent: null, lastLeadScore: null, summary: null, suggestedReply: null, ...over,
  }) as Conversation;

const message = (id: string, text: string, direction = MessageDirection.Inbound, over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id, direction, messageType: 'Text', text, templateName: null, status: MessageStatus.Delivered, sentAt: null, deliveredAt: null, readAt: null, createdAt: hoursAgo(2), ...over,
});

describe('BookingConversationPanelComponent', () => {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(setup: { conversation?: Conversation; messages?: ConversationMessage[]; fail?: boolean; sent?: ConversationMessage } = {}) {
    const api = {
      getById: jasmine.createSpy('getById').and.callFake(() => (setup.fail ? throwError(() => new Error('down')) : of(setup.conversation ?? conversation()))),
      // The API returns the newest message first.
      getMessages: jasmine.createSpy('getMessages').and.returnValue(
        of({ items: setup.messages ?? [message('m2', 'Yes, 4 PM works', MessageDirection.Inbound), message('m1', 'Hello, your demo is on Monday', MessageDirection.Outbound)], totalCount: 2, page: 1, pageSize: 30, totalPages: 1 })
      ),
      sendMessage: jasmine.createSpy('sendMessage').and.callFake((_id: string, request: { text?: string | null }) =>
        of(setup.sent ?? message('m3', request.text ?? '', MessageDirection.Outbound, { status: MessageStatus.Sent }))
      ),
    };
    const templates = {
      getPaged: jasmine.createSpy('getPaged').and.returnValue(
        of({
          items: [
            { id: 't1', name: 'demo_reschedule', isActive: true, whatsAppTemplateStatus: WhatsAppTemplateStatus.Approved },
            { id: 't2', name: 'pending_one', isActive: true, whatsAppTemplateStatus: WhatsAppTemplateStatus.Pending },
            { id: 't3', name: 'switched_off', isActive: false, whatsAppTemplateStatus: WhatsAppTemplateStatus.Approved },
          ],
          totalCount: 3, page: 1, pageSize: 100, totalPages: 1,
        })
      ),
    };
    const notify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    TestBed.configureTestingModule({
      declarations: [BookingConversationPanelComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ConversationService, useValue: api },
        { provide: MessageTemplateService, useValue: templates },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const fixture = TestBed.createComponent(BookingConversationPanelComponent);
    fixture.componentInstance.conversationId = 'c1';
    fixture.componentInstance.context = 'Demo: Demo on Mon 2 Nov at 4:00 PM IST; all topics.';
    fixture.componentInstance.ngOnChanges({ conversationId: { currentValue: 'c1', previousValue: null, firstChange: true, isFirstChange: () => true } });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const type = (value: string) => {
      const box = root.querySelector('[data-testid=message-box]') as HTMLTextAreaElement;
      box.value = value;
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const send = () => {
      (root.querySelector('[data-testid=send]') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    return { fixture, root, api, templates, notify, type, send };
  }

  it('shows who it is, what the booking is about and the recent messages oldest first', () => {
    const { root } = render();

    expect(text(root.querySelector('.who-name'))).toBe('Asha Verma');
    expect(text(root.querySelector('.who-phone'))).toBe('+919000000001');
    expect(text(root.querySelector('[data-testid=context]'))).toBe('Demo: Demo on Mon 2 Nov at 4:00 PM IST; all topics.');
    const bubbles = Array.from(root.querySelectorAll('.msg-text')).map((b) => text(b));
    expect(bubbles).toEqual(['Hello, your demo is on Monday', 'Yes, 4 PM works']);
  });

  it('links to the full conversation and closes when asked', () => {
    const { fixture, root } = render();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    expect(root.querySelector('[data-testid=open-full]')?.getAttribute('href')).toBe('/conversations/c1');
    (root.querySelector('[data-testid=close-panel]') as HTMLButtonElement).click();

    expect(closed).toBe(1);
  });

  it('sends free text while the customer window is open, adds it to the chat and clears the box', () => {
    const { root, api, notify, type, send, fixture } = render();

    type('Does Wednesday 11 AM suit you?');
    send();

    expect(api.sendMessage).toHaveBeenCalledWith('c1', { text: 'Does Wednesday 11 AM suit you?', messageTemplateId: null });
    const bubbles = Array.from(root.querySelectorAll('.msg-text')).map((b) => text(b));
    expect(bubbles[bubbles.length - 1]).toBe('Does Wednesday 11 AM suit you?');
    expect((root.querySelector('[data-testid=message-box]') as HTMLTextAreaElement).value).toBe('');
    expect(notify.success).toHaveBeenCalledWith('Message sent.');
    expect(fixture.componentInstance.sending).toBeFalse();
  });

  it('will not send an empty message', () => {
    const { root, type } = render();

    expect((root.querySelector('[data-testid=send]') as HTMLButtonElement).disabled).toBeTrue();
    type('   ');
    expect((root.querySelector('[data-testid=send]') as HTMLButtonElement).disabled).toBeTrue();
    type('Hello');
    expect((root.querySelector('[data-testid=send]') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('offers only a template once the 24-hour window is closed, and sends it', () => {
    const { root, api, fixture } = render({ conversation: conversation({ lastInboundMessageAt: hoursAgo(30) }) });

    expect(text(root.querySelector('[data-testid=window-closed]'))).toContain("free text can't be sent");
    expect(root.querySelector('[data-testid=message-box]')).toBeNull();
    // Only an approved, active template can be chosen.
    expect(fixture.componentInstance.approvedTemplates.map((t) => t.name)).toEqual(['demo_reschedule']);

    fixture.componentInstance.composeForm.patchValue({ messageTemplateId: 't1' });
    fixture.detectChanges();
    (root.querySelector('[data-testid=send]') as HTMLButtonElement).click();

    expect(api.sendMessage).toHaveBeenCalledWith('c1', { text: null, messageTemplateId: 't1' });
  });

  it('cannot send anything in a conversation that is closed', () => {
    const { root, api } = render({ conversation: conversation({ status: 'Closed' }) });

    expect(text(root.querySelector('[data-testid=closed-conversation]'))).toContain('closed');
    expect((root.querySelector('[data-testid=send]') as HTMLButtonElement).disabled).toBeTrue();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('says when WhatsApp did not accept the message', () => {
    const { notify, type, send } = render({ sent: message('m9', 'Hi', MessageDirection.Outbound, { status: MessageStatus.Failed }) });

    type('Hi');
    send();

    expect(notify.error).toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('keeps the message the team typed when the send is refused', () => {
    const { root, api, type, send } = render();
    api.sendMessage.and.returnValue(throwError(() => new Error('window closed')));

    type('Does Wednesday suit you?');
    send();

    expect((root.querySelector('[data-testid=message-box]') as HTMLTextAreaElement).value).toBe('Does Wednesday suit you?');
  });

  it('says so when the conversation could not be loaded, and tries again', () => {
    const { root, fixture, api } = render({ fail: true });

    expect(text(root.querySelector('[data-testid=panel-failed]'))).toContain('could not be loaded');

    api.getById.and.returnValue(of(conversation()));
    (root.querySelector('[data-testid=panel-failed] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid=panel-failed]')).toBeNull();
    expect(text(root.querySelector('.who-name'))).toBe('Asha Verma');
  });

  it('shows a different conversation when it is pointed at one', () => {
    const { fixture, api, root } = render();
    api.getById.and.returnValue(of(conversation({ id: 'c2', customerName: 'Ravi Kumar' })));

    fixture.componentInstance.conversationId = 'c2';
    fixture.componentInstance.ngOnChanges({ conversationId: { currentValue: 'c2', previousValue: 'c1', firstChange: false, isFirstChange: () => false } });
    fixture.detectChanges();

    expect(api.getById).toHaveBeenCalledWith('c2');
    expect(text(root.querySelector('.who-name'))).toBe('Ravi Kumar');
  });

  it('puts a drafted message in the box, for the team to read and send, when free text can be sent', () => {
    const { fixture, root } = render();

    fixture.componentInstance.draft = 'Hi Asha, could we do Wed, 4 Nov, 11:00 am IST instead?';
    fixture.componentInstance.ngOnChanges({ draft: { currentValue: fixture.componentInstance.draft, previousValue: null, firstChange: false, isFirstChange: () => false } });
    fixture.detectChanges();

    expect((root.querySelector('[data-testid=message-box]') as HTMLTextAreaElement).value).toBe('Hi Asha, could we do Wed, 4 Nov, 11:00 am IST instead?');
  });

  it('leaves the box alone when the 24-hour window is closed, because free text cannot be sent then', () => {
    const { fixture, root } = render({ conversation: conversation({ lastInboundMessageAt: hoursAgo(30) }) });

    fixture.componentInstance.draft = 'Hi Asha';
    fixture.componentInstance.ngOnChanges({ draft: { currentValue: 'Hi Asha', previousValue: null, firstChange: false, isFirstChange: () => false } });
    fixture.detectChanges();

    expect(fixture.componentInstance.composeForm.getRawValue().text).toBe('');
    expect(root.querySelector('[data-testid=window-closed]')).not.toBeNull();
  });
});

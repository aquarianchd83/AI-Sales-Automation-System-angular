import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';

import { Conversation, ConversationMode, ConversationStatus, MessageDirection, MessageStatus } from '../../../core/models/conversation.model';
import { ConversationDetailComponent } from './conversation-detail.component';

describe('ConversationDetailComponent — the AI draft (Hybrid mode)', () => {
  const conversation = (suggestedReply: string | null): Conversation => ({
    id: 'c1',
    customerId: 'cu1',
    customerPhoneNumberE164: '+919000000001',
    customerName: 'Asha',
    mode: ConversationMode.Hybrid,
    status: ConversationStatus.Escalated,
    assignedAgentId: null,
    lastMessageAt: null,
    lastInboundMessageAt: null,
    createdAt: '2026-10-02T10:00:00Z',
    closedAt: null,
    aiConfidenceLast: 0.9,
    lastDetectedIntent: 'Negotiation',
    lastLeadScore: null,
    summary: null,
    suggestedReply,
  });

  const sentMessage = {
    id: 'm1',
    direction: MessageDirection.Outbound,
    messageType: 'Text',
    text: 'Hi Asha, this is Ravi.',
    templateName: null,
    status: MessageStatus.Sent,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    createdAt: '2026-10-02T10:05:00Z',
  };

  function create(draft: string | null): ConversationDetailComponent {
    const service = { sendMessage: () => of(sentMessage) } as any;
    const component = new ConversationDetailComponent(
      {} as any,
      {} as any,
      service,
      {} as any,
      {} as any,
      {} as any,
      { error: () => undefined } as any,
      new FormBuilder()
    );
    component.conversation = conversation(draft);
    return component;
  }

  it('offers the draft the AI held back', () => {
    expect(create('Let me check what I can do.').suggestedReply).toBe('Let me check what I can do.');
  });

  it('offers nothing when there is no draft', () => {
    expect(create(null).suggestedReply).toBeNull();
  });

  it('puts the draft in the message box, in text mode, ready to edit', () => {
    const component = create('Let me check what I can do.');
    component.composeForm.patchValue({ mode: 'template' });

    component.useSuggestion();

    expect(component.composeForm.getRawValue().mode).toBe('text');
    expect(component.composeForm.getRawValue().text).toBe('Let me check what I can do.');
  });

  it('stops offering the draft once dismissed', () => {
    const component = create('Let me check what I can do.');

    component.dismissSuggestion();

    expect(component.suggestedReply).toBeNull();
  });

  it('drops the draft once the agent sends something', () => {
    const component = create('Let me check what I can do.');
    component.composeForm.patchValue({ text: 'Hi Asha, this is Ravi.' });

    component.send();

    expect(component.suggestedReply).toBeNull();
    expect(component.messages.length).toBe(1);
  });
});

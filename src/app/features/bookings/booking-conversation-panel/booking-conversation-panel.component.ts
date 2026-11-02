import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import {
  DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS,
  Conversation,
  ConversationMessage,
  MessageDirection,
  MessageStatus,
  canActOnConversation,
  canSendFreeText,
} from '../../../core/models/conversation.model';
import { MessageTemplate, WhatsAppTemplateStatus } from '../../../core/models/message-template.model';
import { ConversationService } from '../../../core/services/conversation.service';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';

/** How much of the chat the panel shows; the full conversation is one click away. */
const RECENT_MESSAGES = 30;

/**
 * The conversation behind a booking, beside the list: the recent messages and a box to reply, so the team can agree a new time or confirm a demo without
 * leaving the page. It sends the same way the conversation screen does - free text only while the customer's 24-hour window is open, an approved template
 * at any time - and the server enforces both.
 */
@Component({
  selector: 'app-booking-conversation-panel',
  templateUrl: './booking-conversation-panel.component.html',
  styleUrls: ['./booking-conversation-panel.component.scss'],
})
export class BookingConversationPanelComponent implements OnChanges {
  /** The conversation to show. */
  @Input() conversationId: string | null = null;
  /** What the booking is about, shown under the name so the reply has its context: "Demo on Mon 2 Nov at 4:00 PM IST". */
  @Input() context: string | null = null;
  /** A message ready in the box for the team to read, change and send - never sent for them. Only fills the box when free text can be sent. */
  @Input() draft: string | null = null;
  @Output() closed = new EventEmitter<void>();

  readonly MessageDirection = MessageDirection;
  readonly MessageStatus = MessageStatus;
  readonly composeForm = this.fb.nonNullable.group({
    mode: this.fb.nonNullable.control<'text' | 'template'>('text'),
    text: ['', [Validators.maxLength(4000)]],
    messageTemplateId: [null as string | null],
  });

  conversation: Conversation | null = null;
  /** Oldest first, top to bottom. */
  messages: ConversationMessage[] = [];
  approvedTemplates: MessageTemplate[] = [];
  loading = false;
  failed = false;
  sending = false;

  constructor(
    private readonly conversations: ConversationService,
    private readonly templates: MessageTemplateService,
    private readonly notify: NotificationService,
    private readonly fb: FormBuilder
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conversationId']) {
      this.load();
    } else if (changes['draft']) {
      this.applyDraft();
    }
  }

  private applyDraft(): void {
    if (this.draft && this.canAct && this.canSendText) {
      this.composeForm.patchValue({ mode: 'text', text: this.draft });
    }
  }

  get canAct(): boolean {
    return !!this.conversation && canActOnConversation(this.conversation.status);
  }

  get canSendText(): boolean {
    return !!this.conversation && canSendFreeText(this.conversation.lastInboundMessageAt, DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS);
  }

  get canSubmit(): boolean {
    if (!this.canAct || this.sending) {
      return false;
    }
    const raw = this.composeForm.getRawValue();
    return raw.mode === 'text' ? this.canSendText && !!raw.text.trim() : !!raw.messageTemplateId;
  }

  load(): void {
    this.conversation = null;
    this.messages = [];
    this.failed = false;
    this.composeForm.patchValue({ mode: 'text', text: '', messageTemplateId: null });
    if (!this.conversationId) {
      return;
    }

    this.loading = true;
    forkJoin({
      conversation: this.conversations.getById(this.conversationId),
      page: this.conversations.getMessages(this.conversationId, { page: 1, pageSize: RECENT_MESSAGES }),
      // Templates are only for a closed window; not being able to read them must not stop the chat from showing.
      templates: this.templates.getPaged({ page: 1, pageSize: 100 }).pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ conversation, page, templates }) => {
          this.conversation = conversation;
          // The API returns newest first; the panel reads oldest first.
          this.messages = [...page.items].reverse();
          this.approvedTemplates = (templates?.items ?? []).filter((t) => t.isActive && t.whatsAppTemplateStatus === WhatsAppTemplateStatus.Approved);
          // Land on whichever way of sending works right now, not a disabled Text option.
          if (!canSendFreeText(conversation.lastInboundMessageAt, DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS)) {
            this.composeForm.patchValue({ mode: 'template' });
          }
          // Free text is off while the window is closed, and everything is off once the conversation is.
          const text = this.composeForm.controls.text;
          const template = this.composeForm.controls.messageTemplateId;
          this.canSendText && this.canAct ? text.enable() : text.disable();
          this.canAct ? template.enable() : template.disable();
          this.applyDraft();
        },
        error: () => (this.failed = true),
      });
  }

  send(): void {
    if (!this.conversation || !this.canSubmit) {
      return;
    }
    const raw = this.composeForm.getRawValue();
    const request = raw.mode === 'text' ? { text: raw.text.trim(), messageTemplateId: null } : { text: null, messageTemplateId: raw.messageTemplateId };

    this.sending = true;
    this.conversations
      .sendMessage(this.conversation.id, request)
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: (message) => {
          this.messages = [...this.messages, message];
          this.composeForm.patchValue({ text: '', messageTemplateId: null });
          if (message.status === MessageStatus.Failed) {
            this.notify.error('WhatsApp did not accept the message - see its status in the chat.');
          } else {
            this.notify.success('Message sent.');
          }
        },
        // The error interceptor says why (window closed, customer opted out, template not approved).
        error: () => undefined,
      });
  }
}

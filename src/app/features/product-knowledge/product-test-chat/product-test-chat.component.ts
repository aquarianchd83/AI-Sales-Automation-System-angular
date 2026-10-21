import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { TestChatReply, TestChatTurn } from '../../../core/models/product-test-chat.model';
import { ProductTestChatService } from '../../../core/services/product-test-chat.service';
import { PublishedKnowledgeService } from '../../../core/services/published-knowledge.service';

export interface ChatMessage {
  id: number;
  /** "note" is the tester's margin note (a person would take over here), not something a customer sees. */
  role: 'customer' | 'assistant' | 'note';
  text: string;
  at: Date;
  reply?: TestChatReply;
  showWhy?: boolean;
}

/**
 * A page for trying the AI before customers do. The tenant types as a customer and the AI answers from the live published version - the same search,
 * the same wording rules and the same safety checks as real chat - and carries on the conversation. "Why this answer" shows which approved answers it
 * used. Nothing is stored, sent on WhatsApp or charged. The conversation lives only in this page.
 */
@Component({
  selector: 'app-product-test-chat',
  templateUrl: './product-test-chat.component.html',
  styleUrls: ['./product-test-chat.component.scss'],
})
export class ProductTestChatComponent implements OnInit, AfterViewChecked {
  readonly input = new FormControl('', { nonNullable: true });
  readonly messages: ChatMessage[] = [];

  loading = true;
  loadFailed = false;
  /** The version live for chat now, or null when nothing has been published and made ready. */
  liveVersion: number | null = null;
  liveChatOn = false;
  /** The platform AI is the Simulator, so this chat is only connected with it. */
  simulated = false;
  sending = false;

  @ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;
  private scrollPending = false;
  private nextId = 1;

  constructor(
    private readonly chat: ProductTestChatService,
    private readonly published: PublishedKnowledgeService
  ) {}

  ngOnInit(): void {
    this.published
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (o) => {
          this.liveVersion = o.servingVersionNumber;
          this.liveChatOn = o.chatUsesPublishedKnowledge;
          this.simulated = o.platformAiSimulated === true;
        },
        error: () => (this.loadFailed = true),
      });
  }

  ngAfterViewChecked(): void {
    if (this.scrollPending && this.scroller) {
      this.scroller.nativeElement.scrollTop = this.scroller.nativeElement.scrollHeight;
      this.scrollPending = false;
    }
  }

  get canSend(): boolean {
    return !this.sending && this.input.value.trim().length > 0 && this.liveVersion !== null;
  }

  /** Enter sends; Shift+Enter makes a new line. */
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    if (!this.canSend) {
      return;
    }
    const text = this.input.value.trim();
    const history = this.history();
    const sent = this.push('customer', text);
    this.input.reset('');
    this.sending = true;

    this.chat
      .ask(text, history)
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: (reply) => {
          this.platformNotice = reply.platformNotice ?? null;
          if (reply.reply) {
            this.push('assistant', reply.reply, reply);
          } else {
            this.push('note', reply.why, reply);
          }
        },
        // ErrorInterceptor says why. The question is put back so it can be sent again.
        error: () => {
          this.messages.splice(this.messages.indexOf(sent), 1);
          this.input.setValue(text);
          this.scrollPending = true;
        },
      });
  }

  /** What the platform asks the tester to know (the AI is in test mode); shown until a reply says otherwise. */
  platformNotice: string | null = null;

  toggleWhy(message: ChatMessage): void {
    message.showWhy = !message.showWhy;
  }

  /** Starts over: a new customer, nothing remembered. */
  reset(): void {
    this.messages.length = 0;
    this.input.reset('');
  }

  /** The conversation so far as the server needs it: customer and AI turns only, each AI turn with what the server decided for it. */
  private history(): TestChatTurn[] {
    return this.messages
      .filter((m) => m.role !== 'note')
      .map((m) => (m.role === 'customer' ? { role: 'customer' as const, text: m.text } : { role: 'assistant' as const, text: m.text, kind: m.reply?.outcome }));
  }

  private push(role: ChatMessage['role'], text: string, reply?: TestChatReply): ChatMessage {
    const message: ChatMessage = { id: this.nextId++, role, text, at: new Date(), reply };
    this.messages.push(message);
    this.scrollPending = true;
    return message;
  }
}

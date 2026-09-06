import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subject, forkJoin } from 'rxjs';
import { filter, finalize, switchMap, takeUntil } from 'rxjs/operators';

import {
  DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS,
  Conversation,
  ConversationMessage,
  ConversationMode,
  MessageDirection,
  MessageStatus,
  canActOnConversation,
  canSendFreeText,
  conversationStatusChipClass,
} from '../../../core/models/conversation.model';
import { ConversationHubService, MessageStatusUpdatedEvent } from '../../../core/services/conversation-hub.service';
import { ConversationService } from '../../../core/services/conversation.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { leadScoreChipClass } from '../../../core/models/lead.model';
import { MessageTemplate, WhatsAppTemplateStatus } from '../../../core/models/message-template.model';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { User } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-conversation-detail',
  templateUrl: './conversation-detail.component.html',
  styleUrls: ['./conversation-detail.component.scss'],
})
export class ConversationDetailComponent implements OnInit, OnDestroy {
  readonly statusClass = conversationStatusChipClass;
  readonly scoreClass = leadScoreChipClass;
  readonly modes = Object.values(ConversationMode);
  readonly MessageDirection = MessageDirection;
  readonly MessageStatus = MessageStatus;
  readonly composeForm = this.fb.nonNullable.group({
    mode: this.fb.nonNullable.control<'text' | 'template'>('text'),
    text: ['', [Validators.maxLength(4000)]],
    messageTemplateId: [null as string | null],
  });

  conversation: Conversation | null = null;
  loading = true;
  actionInFlight = false;
  sending = false;

  /** Oldest-first, top to bottom — the API returns each page newest-first, reversed here. */
  messages: ConversationMessage[] = [];
  loadingMessages = false;
  loadingOlder = false;
  private messagesPage = 0;
  hasMoreOlder = true;

  agents: User[] = [];
  approvedTemplates: MessageTemplate[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly conversations: ConversationService,
    private readonly templateService: MessageTemplateService,
    private readonly users: UserService,
    private readonly conversationHub: ConversationHubService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.loading = true;
          const id = params.get('id') ?? '';
          return this.conversations.getById(id);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (conversation) => {
          this.conversation = conversation;
          this.loading = false;
          this.messages = [];
          this.messagesPage = 0;
          this.hasMoreOlder = true;
          this.loadOlder();
          // Default to whichever compose mode is actually usable right now, rather than
          // landing on a disabled "Text" option when the customer service window is closed.
          if (!canSendFreeText(conversation.lastInboundMessageAt, DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS)) {
            this.composeForm.patchValue({ mode: 'template' });
          }
        },
        error: () => {
          this.conversation = null;
          this.loading = false;
        },
      });

    forkJoin({
      agents: this.users.getPaged({ page: 1, pageSize: 100 }),
      templates: this.templateService.getPaged({ page: 1, pageSize: 100 }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ agents, templates }) => {
        this.agents = agents.items.filter((u) => u.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName));
        this.approvedTemplates = templates.items.filter(
          (t) => t.isActive && t.whatsAppTemplateStatus === WhatsAppTemplateStatus.Approved
        );
      });

    // Live update: the hub broadcasts every inbound message to every connected client (see
    // ConversationHubService), so filter to this conversation before doing anything. By the time
    // this event fires, InboundWebhookProcessor has already run the AI orchestrator and saved
    // whatever it decided — refetching the conversation here picks up its updated
    // confidence/intent/summary/lead-score alongside the new message, not just the message itself.
    this.conversationHub.newInboundMessage$
      .pipe(
        filter((event) => event.conversationId === this.conversation?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.refreshLatestMessages();
        this.refreshConversation();
      });

    // Live update: an outbound message's delivery status advanced (e.g. the customer read it on
    // WhatsApp). Patched in place rather than refetching the page — the hub payload already has
    // everything the transcript needs to reflect it.
    this.conversationHub.messageStatusUpdated$
      .pipe(
        filter((event) => event.conversationId === this.conversation?.id),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => this.applyMessageStatusUpdate(event));

    // The hub broadcasts to whoever's connected at the moment, nothing more — a status update (or
    // inbound message) that lands while this client is disconnected/reconnecting is otherwise lost
    // for good, not just delayed. Resync on every reconnect to close that gap.
    this.conversationHub.reconnected$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refreshLatestMessages();
      this.refreshConversation();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canAct(): boolean {
    return !!this.conversation && canActOnConversation(this.conversation.status);
  }

  get canSendText(): boolean {
    return !!this.conversation && canSendFreeText(this.conversation.lastInboundMessageAt, DEFAULT_CUSTOMER_SERVICE_WINDOW_HOURS);
  }

  agentName(agentId: string | null): string {
    if (!agentId) {
      return 'Unassigned';
    }
    return this.agents.find((a) => a.id === agentId)?.fullName ?? 'Unknown agent';
  }

  loadOlder(): void {
    if (!this.conversation || this.loadingOlder || !this.hasMoreOlder) {
      return;
    }
    const nextPage = this.messagesPage + 1;
    this.loadingOlder = true;
    this.loadingMessages = this.messagesPage === 0;
    this.conversations
      .getMessages(this.conversation.id, { page: nextPage, pageSize: 30 })
      .pipe(finalize(() => (this.loadingOlder = this.loadingMessages = false)))
      .subscribe((page) => {
        this.messagesPage = nextPage;
        this.hasMoreOlder = nextPage < page.totalPages;
        // The API returns each page newest-first; reversing gives oldest-first within the page,
        // and prepending keeps the overall list oldest-first top to bottom as older pages load in.
        this.messages = [...page.items].reverse().concat(this.messages);
      });
  }

  /** Pulls in whatever's new without disturbing already-loaded older pages — refetches just the
   * most recent batch, appends any message not already in the transcript (deduped by id), and
   * overwrites the rest in place with the server's copy. That last part matters as much as the
   * append: this is also what a hub reconnect uses to resync (see the `reconnected$` subscription
   * in ngOnInit), and a status update the client missed while disconnected would otherwise stay
   * silently stale forever on an already-loaded message — refetching alone wouldn't fix it if this
   * only ever added messages it had never seen before. */
  private refreshLatestMessages(): void {
    if (!this.conversation) {
      return;
    }
    this.conversations.getMessages(this.conversation.id, { page: 1, pageSize: 30 }).subscribe((page) => {
      const latestById = new Map(page.items.map((m) => [m.id, m]));
      const merged = this.messages.map((m) => latestById.get(m.id) ?? m);
      const existingIds = new Set(this.messages.map((m) => m.id));
      const newOnes = [...page.items].reverse().filter((m) => !existingIds.has(m.id));
      this.messages = [...merged, ...newOnes];
    });
  }

  /** Patches one message's status (and delivered/read timestamp) in place from a hub event —
   * mirrors ApplyStatusUpdateAsync's `??=` semantics on the backend: only fill a timestamp the
   * server hasn't already sent us via a normal fetch. */
  private applyMessageStatusUpdate(event: MessageStatusUpdatedEvent): void {
    const now = new Date().toISOString();
    this.messages = this.messages.map((m) => {
      if (m.id !== event.messageId) {
        return m;
      }
      return {
        ...m,
        status: event.status,
        deliveredAt: m.deliveredAt ?? (event.status === MessageStatus.Delivered || event.status === MessageStatus.Read ? now : m.deliveredAt),
        readAt: m.readAt ?? (event.status === MessageStatus.Read ? now : m.readAt),
      };
    });
  }

  private refreshConversation(): void {
    if (!this.conversation) {
      return;
    }
    this.conversations.getById(this.conversation.id).subscribe((conversation) => (this.conversation = conversation));
  }

  changeMode(mode: string): void {
    if (!this.conversation) {
      return;
    }
    this.actionInFlight = true;
    this.conversations
      .changeMode(this.conversation.id, { mode })
      .pipe(finalize(() => (this.actionInFlight = false)))
      .subscribe({
        next: (conversation) => {
          this.conversation = conversation;
          this.notify.success('Mode updated.');
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  assign(agentId: string): void {
    if (!this.conversation || !agentId) {
      return;
    }
    this.actionInFlight = true;
    this.conversations
      .assign(this.conversation.id, { agentId })
      .pipe(finalize(() => (this.actionInFlight = false)))
      .subscribe({
        next: (conversation) => {
          this.conversation = conversation;
          this.notify.success('Conversation assigned.');
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  close(): void {
    if (!this.conversation) {
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Close this conversation?',
      message: 'It moves out of the Open/Escalated views. A new inbound message from this customer starts a fresh conversation rather than reopening this one.',
      confirmLabel: 'Close',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed || !this.conversation) {
          return;
        }
        this.actionInFlight = true;
        this.conversations
          .close(this.conversation.id)
          .pipe(finalize(() => (this.actionInFlight = false)))
          .subscribe({
            next: (conversation) => {
              this.conversation = conversation;
              this.notify.success('Conversation closed.');
            },
            error: () => {
              // ErrorInterceptor toasts it.
            },
          });
      });
  }

  send(): void {
    if (!this.conversation || this.sending) {
      return;
    }
    const raw = this.composeForm.getRawValue();
    const request =
      raw.mode === 'text' ? { text: raw.text.trim(), messageTemplateId: null } : { text: null, messageTemplateId: raw.messageTemplateId };

    if (raw.mode === 'text' && !request.text) {
      return;
    }
    if (raw.mode === 'template' && !request.messageTemplateId) {
      return;
    }

    this.sending = true;
    this.conversations
      .sendMessage(this.conversation.id, request)
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: (message) => {
          this.messages = [...this.messages, message];
          this.composeForm.patchValue({ text: '', messageTemplateId: null });
          if (message.status === MessageStatus.Failed) {
            this.notify.error('WhatsApp did not accept the message — see its status in the transcript.');
          }
        },
        error: () => {
          // ErrorInterceptor toasts it (e.g. window closed, customer opted out, template not Approved).
        },
      });
  }
}

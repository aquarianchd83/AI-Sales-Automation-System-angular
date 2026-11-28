import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, interval, merge } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import {
  PlatformConversation,
  PlatformConversationContact,
  PlatformConversationInvite,
  PlatformConversationMessage,
  PlatformConversationTemplate,
} from '../../../core/models/platform-conversation.model';
import { NotificationHubService } from '../../../core/services/notification-hub.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformConversationService } from '../../../core/services/platform-conversation.service';

type ComposeMode = 'text' | 'template';

/**
 * Tenant Conversations: the platform admin chats with tenants on WhatsApp from the PLATFORM's own number (the one tenant notices go from).
 * WhatsApp only delivers free text within 24 hours of the tenant's last message, so outside that window the compose box switches to an
 * approved platform template; the tenant's reply re-opens the window. Replies arrive live (SignalR) with a slow poll as the fallback.
 * Every timestamp is UTC from the API and shown in the viewer's time zone through zonedDate.
 */
@Component({
  selector: 'app-platform-conversations',
  templateUrl: './platform-conversations.component.html',
  styleUrls: ['./platform-conversations.component.scss'],
})
export class PlatformConversationsComponent implements OnInit, OnDestroy {
  @ViewChild('transcript') transcript?: ElementRef<HTMLElement>;

  conversations: PlatformConversation[] = [];
  loadingList = true;
  readonly search = this.fb.control('');

  selected: PlatformConversation | null = null;
  messages: PlatformConversationMessage[] = [];
  hasOlder = false;
  loadingMessages = false;
  loadingOlder = false;

  templates: PlatformConversationTemplate[] = [];
  readonly composeForm = this.fb.group({
    mode: this.fb.control<ComposeMode>('text'),
    text: '',
    templateId: '',
    title: '',
    message: '',
  });
  sending = false;

  /** How to get the tenant to write first: the wa.me link and their email. Loaded with each chat. */
  invite: PlatformConversationInvite | null = null;
  readonly inviteNote = this.fb.control('');
  emailingInvite = false;

  // "New chat": pick a tenant (and one of its numbers), or type any number.
  showNewChat = false;
  readonly contactSearch = this.fb.control('');
  contacts: PlatformConversationContact[] = [];
  pickedContact: PlatformConversationContact | null = null;
  readonly newPhone = this.fb.control('');
  starting = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly service: PlatformConversationService,
    private readonly hub: NotificationHubService,
    private readonly notify: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadList();
    this.loadTemplates();

    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadList());

    this.contactSearch.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        filter((v) => typeof v === 'string'),
        switchMap((v) => this.service.contacts(v.trim() || undefined)),
        takeUntil(this.destroy$),
      )
      .subscribe((contacts) => (this.contacts = contacts));

    // A reply landed or a status moved: refresh the list, and the open chat when it is that one. The poll covers a dropped live connection.
    merge(this.hub.platformConversationUpdated$, interval(20000))
      .pipe(takeUntil(this.destroy$))
      .subscribe((id) => {
        this.loadList(true);
        if (
          this.selected &&
          (typeof id === 'number' || id === this.selected.id)
        ) {
          this.reloadSelected();
        }
      });

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const tenantId = params.get('tenantId');
        const id = params.get('id');
        if (tenantId) {
          this.startWith(tenantId, null);
        } else if (id && id !== this.selected?.id) {
          this.open(id);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── List ────────────────────────────────────────────────────────────────

  displayName(c: PlatformConversation): string {
    return c.tenantName || c.contactName || c.phoneE164;
  }

  select(c: PlatformConversation): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: c.id },
      replaceUrl: true,
    });
  }

  private loadList(quiet = false): void {
    if (!quiet) {
      this.loadingList = true;
    }
    this.service
      .list(this.search.value.trim() || undefined)
      .pipe(finalize(() => (this.loadingList = false)))
      .subscribe({
        next: (list) => {
          this.conversations = list;
          const fresh =
            this.selected && list.find((c) => c.id === this.selected!.id);
          if (fresh) {
            this.selected = { ...fresh, unreadCount: 0 };
            this.syncComposeMode();
          }
        },
        error: () => undefined,
      });
  }

  // ── Chat ────────────────────────────────────────────────────────────────

  private open(id: string): void {
    this.loadingMessages = true;
    this.messages = [];
    this.service
      .get(id)
      .pipe(finalize(() => (this.loadingMessages = false)))
      .subscribe({
        next: (detail) => {
          this.selected = detail.conversation;
          this.messages = detail.messages;
          this.hasOlder = detail.hasOlder;
          this.composeForm.patchValue({ text: '', title: '', message: '' });
          this.syncComposeMode(true);
          this.loadInvite(id);
          const row = this.conversations.find((c) => c.id === id);
          if (row) {
            row.unreadCount = 0;
          }
          this.scrollToBottom();
        },
        error: () => (this.selected = null),
      });
  }

  /** Newest page again, keeping any older messages already loaded above it. */
  private reloadSelected(): void {
    const current = this.selected;
    if (!current) {
      return;
    }
    this.service.get(current.id).subscribe({
      next: (detail) => {
        if (this.selected?.id !== current.id) {
          return;
        }
        const newestIds = new Set(detail.messages.map((m) => m.id));
        const oldestNew = detail.messages[0]?.sentAtUtc;
        const older = oldestNew
          ? this.messages.filter(
              (m) => !newestIds.has(m.id) && m.sentAtUtc < oldestNew,
            )
          : [];
        const grew =
          detail.messages.length + older.length !== this.messages.length;
        this.messages = [...older, ...detail.messages];
        this.selected = detail.conversation;
        this.syncComposeMode();
        if (grew) {
          this.scrollToBottom();
        }
      },
      error: () => undefined,
    });
  }

  loadOlder(): void {
    const c = this.selected;
    const oldest = this.messages[0];
    if (!c || !oldest || this.loadingOlder) {
      return;
    }
    this.loadingOlder = true;
    this.service
      .get(c.id, oldest.sentAtUtc)
      .pipe(finalize(() => (this.loadingOlder = false)))
      .subscribe({
        next: (detail) => {
          this.messages = [...detail.messages, ...this.messages];
          this.hasOlder = detail.hasOlder;
        },
        error: () => undefined,
      });
  }

  statusIcon(m: PlatformConversationMessage): string {
    switch (m.status) {
      case 'Queued':
        return 'schedule';
      case 'Sent':
        return 'done';
      case 'Delivered':
        return 'done_all';
      case 'Read':
        return 'done_all';
      default:
        return 'error_outline';
    }
  }

  // ── Compose ─────────────────────────────────────────────────────────────

  get mode(): ComposeMode {
    return this.composeForm.controls.mode.value;
  }

  get selectedTemplate(): PlatformConversationTemplate | null {
    return (
      this.templates.find(
        (t) => t.id === this.composeForm.controls.templateId.value,
      ) ?? null
    );
  }

  get canSend(): boolean {
    if (!this.selected || this.sending) {
      return false;
    }
    if (this.mode === 'text') {
      return (
        this.selected.windowOpen &&
        !!this.composeForm.controls.text.value.trim()
      );
    }
    const t = this.selectedTemplate;
    return (
      !!t &&
      (!t.usesMessage || !!this.composeForm.controls.message.value.trim())
    );
  }

  /** The template's text as the tenant will read it, with what is typed so far. */
  get templatePreview(): string {
    const t = this.selectedTemplate;
    if (!t) {
      return '';
    }
    const values: Record<string, string> = {
      tenantname:
        this.selected?.tenantName || this.selected?.contactName || 'there',
      title: this.composeForm.controls.title.value.trim() || 'an update',
      message: this.composeForm.controls.message.value.trim() || '…',
    };
    return t.bodyText.replace(
      /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g,
      (_, token: string) => values[token.toLowerCase()] ?? '-',
    );
  }

  /** Closed window: only a template can go, so the toggle moves there. An open window defaults back to text when nothing is typed. */
  private syncComposeMode(force = false): void {
    if (!this.selected) {
      return;
    }
    if (!this.selected.windowOpen && this.mode === 'text') {
      this.composeForm.controls.mode.setValue('template');
    } else if (this.selected.windowOpen && force) {
      this.composeForm.controls.mode.setValue('text');
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const c = this.selected;
    if (!c || !this.canSend) {
      return;
    }
    const v = this.composeForm.getRawValue();
    const request =
      v.mode === 'text'
        ? { text: v.text.trim(), templateId: null, title: null, message: null }
        : {
            text: null,
            templateId: v.templateId,
            title: v.title.trim() || null,
            message: v.message.trim() || null,
          };

    this.sending = true;
    this.service
      .send(c.id, request)
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: (message) => {
          this.messages = [...this.messages, message];
          this.scrollToBottom();
          if (message.status === 'Failed') {
            this.notify.error(
              message.errorMessage || 'WhatsApp did not accept the message.',
            );
          } else {
            this.composeForm.patchValue({ text: '', title: '', message: '' });
          }
          this.loadList(true);
        },
        // ErrorInterceptor toasts the reason (e.g. the 24-hour window closed meanwhile); refresh so the window state is current.
        error: () => this.reloadSelected(),
      });
  }

  private loadInvite(id: string): void {
    this.invite = null;
    this.service.invite(id).subscribe({
      next: (invite) => {
        if (this.selected?.id === id) {
          this.invite = invite;
        }
      },
      error: () => undefined,
    });
  }

  copyInviteLink(): void {
    const link = this.invite?.whatsAppLink;
    if (!link) {
      return;
    }
    navigator.clipboard?.writeText(link).then(
      () =>
        this.notify.success(
          'Link copied. Send it to the tenant any way you like.',
        ),
      () => this.notify.error('Could not copy - select the link and copy it.'),
    );
  }

  /** Emails the tenant the link; the email is added to the chat so it is clear what was sent and when. */
  emailInvite(): void {
    const c = this.selected;
    if (
      !c ||
      !this.invite?.email ||
      !this.invite.whatsAppLink ||
      this.emailingInvite
    ) {
      return;
    }
    this.emailingInvite = true;
    this.service
      .emailInvite(c.id, this.inviteNote.value.trim() || null)
      .pipe(finalize(() => (this.emailingInvite = false)))
      .subscribe({
        next: (message) => {
          this.messages = [...this.messages, message];
          this.scrollToBottom();
          if (message.status === 'Failed') {
            this.notify.error(
              message.errorMessage || 'The email could not be sent.',
            );
          } else {
            this.notify.success(`Emailed the link to ${this.invite?.email}.`);
            this.inviteNote.setValue('');
          }
          this.loadList(true);
        },
        error: () => undefined,
      });
  }

  private loadTemplates(): void {
    this.service.templates().subscribe({
      next: (templates) => {
        this.templates = templates;
        if (!this.composeForm.controls.templateId.value && templates.length) {
          this.composeForm.controls.templateId.setValue(
            (templates.find((t) => t.isDefault) ?? templates[0]).id,
          );
        }
      },
      error: () => undefined,
    });
  }

  // ── New chat ────────────────────────────────────────────────────────────

  toggleNewChat(): void {
    this.showNewChat = !this.showNewChat;
    this.pickedContact = null;
    this.newPhone.setValue('');
    this.contactSearch.setValue('');
    if (this.showNewChat) {
      this.service.contacts().subscribe({
        next: (contacts) => (this.contacts = contacts),
        error: () => undefined,
      });
    }
  }

  contactLabel = (c: PlatformConversationContact | string | null): string =>
    typeof c === 'string' ? c : (c?.tenantName ?? '');

  pickContact(c: PlatformConversationContact): void {
    this.pickedContact = c;
    this.newPhone.setValue(c.phones[0]?.phoneE164 ?? '');
  }

  startNewChat(): void {
    const phone = this.newPhone.value.trim();
    if (!this.pickedContact && !phone) {
      this.notify.error('Pick a tenant or enter a WhatsApp number.');
      return;
    }
    this.startWith(this.pickedContact?.tenantId ?? null, phone || null);
  }

  private startWith(tenantId: string | null, phone: string | null): void {
    if (this.starting) {
      return;
    }
    this.starting = true;
    this.service
      .start({ tenantId, phone })
      .pipe(finalize(() => (this.starting = false)))
      .subscribe({
        next: (c) => {
          this.showNewChat = false;
          if (!this.conversations.some((x) => x.id === c.id)) {
            this.conversations = [c, ...this.conversations];
          }
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { id: c.id },
            replaceUrl: true,
          });
        },
        error: () => {
          if (tenantId && !phone) {
            // No number on file: open the form with the tenant picked, so the admin can type one.
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: {},
              replaceUrl: true,
            });
            this.openNewChatFor(tenantId);
          }
        },
      });
  }

  /** The "New chat" form with this tenant already picked and the number box empty. */
  private openNewChatFor(tenantId: string): void {
    this.showNewChat = true;
    this.newPhone.setValue('');
    this.pickedContact = {
      tenantId,
      tenantName: 'Selected tenant',
      phones: [],
      conversationId: null,
    };
    this.contactSearch.setValue('', { emitEvent: false });
    this.service.contacts().subscribe({
      next: (contacts) => {
        this.contacts = contacts;
        const found = contacts.find((c) => c.tenantId === tenantId);
        if (found && this.pickedContact?.tenantId === tenantId) {
          this.pickedContact = { ...found, phones: [] };
          this.contactSearch.setValue(found.tenantName, { emitEvent: false });
        }
      },
      error: () => undefined,
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.transcript?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}

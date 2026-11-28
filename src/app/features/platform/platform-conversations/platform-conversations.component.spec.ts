import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, of, throwError } from 'rxjs';

import {
  PlatformConversation,
  PlatformConversationDetail,
  PlatformConversationTemplate,
} from '../../../core/models/platform-conversation.model';
import { NotificationHubService } from '../../../core/services/notification-hub.service';
import { PlatformConversationService } from '../../../core/services/platform-conversation.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformConversationsComponent } from './platform-conversations.component';

const chat = (
  over: Partial<PlatformConversation> = {},
): PlatformConversation => ({
  id: 'c1',
  tenantId: 't1',
  tenantName: 'Acme Traders',
  phoneE164: '+919820098200',
  contactName: 'Ravi',
  lastMessageAtUtc: '2026-11-27T10:00:00',
  lastInboundAtUtc: '2026-11-27T10:00:00',
  lastMessagePreview: 'Haan, bataiye',
  unreadCount: 2,
  windowOpen: true,
  windowClosesAtUtc: '2026-11-28T10:00:00',
  ...over,
});

const detail = (c: PlatformConversation): PlatformConversationDetail => ({
  conversation: c,
  hasOlder: false,
  messages: [
    {
      id: 'm1',
      direction: 'Inbound',
      body: 'Haan, bataiye',
      messageType: 'text',
      templateName: null,
      status: 'Delivered',
      errorMessage: null,
      sentByEmail: null,
      sentAtUtc: '2026-11-27T10:00:00',
    },
  ],
});

const template: PlatformConversationTemplate = {
  id: 'tp1',
  name: 'Message from the AiSaarthi team',
  whatsAppTemplateName: 'platform_admin_message',
  language: 'en',
  bodyText:
    'Hi {{TenantName}}, the AiSaarthi team has a message about your account. {{Message}} You can reply to this message.',
  usesTitle: false,
  usesMessage: true,
  isDefault: true,
};

describe('PlatformConversationsComponent', () => {
  let fixture: ComponentFixture<PlatformConversationsComponent>;
  let service: jasmine.SpyObj<PlatformConversationService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function build(c: PlatformConversation): void {
    service.list.and.returnValue(of([c]));
    service.get.and.returnValue(of(detail(c)));
    fixture = TestBed.createComponent(PlatformConversationsComponent);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { open(id: string): void }).open(
      c.id,
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj('PlatformConversationService', [
      'list',
      'get',
      'contacts',
      'templates',
      'start',
      'send',
      'invite',
      'emailInvite',
    ]);
    service.templates.and.returnValue(of([template]));
    service.contacts.and.returnValue(of([]));
    service.invite.and.returnValue(
      of({
        platformNumber: '+919800011111',
        whatsAppLink: 'https://wa.me/919800011111?text=Hi%20AiSaarthi%20team',
        email: 'owner@acme.in',
        emailSource: 'Owner',
        prefilledText: 'Hi AiSaarthi team',
        emailSubject:
          'The AiSaarthi team would like to chat with you on WhatsApp',
        emailBody:
          'Hi Acme Traders,\n\nThe AiSaarthi team would like to talk to you on WhatsApp. Please send us a message on +919800011111.',
      }),
    );
    await TestBed.configureTestingModule({
      declarations: [PlatformConversationsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformConversationService, useValue: service },
        {
          provide: NotificationHubService,
          useValue: { platformConversationUpdated$: NEVER },
        },
      ],
    }).compileComponents();
  });

  it('lists the chats and shows the open chat with the tenant reply and an open window', () => {
    build(chat());

    expect(text()).toContain('Acme Traders');
    expect(text()).toContain('Haan, bataiye');
    expect(text()).toContain('Window open');
    expect(fixture.componentInstance.mode).toBe('text');
  });

  it('sends free text inside the window', () => {
    build(chat());
    service.send.and.returnValue(
      of({
        ...detail(chat()).messages[0],
        id: 'm2',
        direction: 'Outbound',
        body: 'Hello',
        status: 'Sent',
      }),
    );

    fixture.componentInstance.composeForm.patchValue({ text: 'Hello' });
    fixture.componentInstance.send();

    expect(service.send).toHaveBeenCalledWith('c1', {
      text: 'Hello',
      templateId: null,
      title: null,
      message: null,
    });
    expect(fixture.componentInstance.messages.length).toBe(2);
  });

  it('switches to a template when the 24-hour window is closed and explains why', () => {
    build(chat({ windowOpen: false, windowClosesAtUtc: null }));

    expect(fixture.componentInstance.mode).toBe('template');
    expect(text()).toContain('Window closed');
    expect(text()).toContain('24-hour window is closed');
    expect(fixture.componentInstance.canSend).toBeFalse(); // the template's message is still empty

    fixture.componentInstance.composeForm.patchValue({
      message: 'Campaign paused hai.',
    });
    expect(fixture.componentInstance.templatePreview).toContain(
      'Hi Acme Traders,',
    );
    expect(fixture.componentInstance.templatePreview).toContain(
      'Campaign paused hai.',
    );
    expect(fixture.componentInstance.canSend).toBeTrue();
  });

  it('opens the new-chat form with the tenant picked when the tenant has no number on file', () => {
    build(chat());
    service.start.and.returnValue(throwError(() => new Error('no number')));
    service.contacts.and.returnValue(
      of([
        {
          tenantId: 't9',
          tenantName: 'Zed Clinic',
          phones: [],
          conversationId: null,
        },
      ]),
    );

    (
      fixture.componentInstance as unknown as {
        startWith(t: string, p: string | null): void;
      }
    ).startWith('t9', null);

    expect(fixture.componentInstance.showNewChat).toBeTrue();
    expect(fixture.componentInstance.pickedContact?.tenantId).toBe('t9');
    expect(fixture.componentInstance.pickedContact?.tenantName).toBe(
      'Zed Clinic',
    );
  });

  it('offers the wa.me link and an email to the tenant when the window is closed', () => {
    build(chat({ windowOpen: false, windowClosesAtUtc: null }));
    const root = fixture.nativeElement as HTMLElement;

    expect(
      root.querySelector('[data-testid=invite-link]')?.getAttribute('href'),
    ).toBe('https://wa.me/919800011111?text=Hi%20AiSaarthi%20team');
    expect(
      root.querySelector('[data-testid=invite-email]')?.textContent,
    ).toContain('owner@acme.in');

    expect(
      root.querySelector('[data-testid=invite-number]')?.textContent,
    ).toContain('+919800011111');
    fixture.componentInstance.inviteNote.setValue('Campaign paused hai.');
    fixture.detectChanges();
    expect(
      root.querySelector('[data-testid=email-preview]')?.textContent,
    ).toContain(
      'Hi Acme Traders,\n\nCampaign paused hai.\n\nThe AiSaarthi team',
    );

    service.emailInvite.and.returnValue(
      of({
        ...detail(chat()).messages[0],
        id: 'm9',
        direction: 'Outbound',
        messageType: 'email',
        body: 'Email to owner@acme.in',
        status: 'Sent',
      }),
    );
    fixture.componentInstance.inviteNote.setValue('Campaign paused hai.');
    fixture.componentInstance.emailInvite();

    expect(service.emailInvite).toHaveBeenCalledWith(
      'c1',
      'Campaign paused hai.',
    );
    expect(
      fixture.componentInstance.messages.some((m) => m.messageType === 'email'),
    ).toBeTrue();
  });

  it('hides the invite while the window is open', () => {
    build(chat());
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid=invite]',
      ),
    ).toBeNull();
  });
});

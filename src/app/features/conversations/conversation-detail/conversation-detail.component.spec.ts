import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { ConversationDetailComponent } from './conversation-detail.component';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';

describe('ConversationDetailComponent — template send', () => {
  let fixture: ComponentFixture<ConversationDetailComponent>;
  let httpMock: HttpTestingController;

  const conversationId = 'conv-1';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConversationDetailComponent],
      imports: [SharedModule, NoopAnimationsModule, HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: conversationId })) },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConversationDetailComponent);
    fixture.detectChanges();

    // Conversation: no inbound message ever (matches the reported repro — a conversation
    // whose window has never opened, forcing Template mode with Text correctly disabled).
    httpMock.expectOne(`${environment.apiBaseUrl}/conversations/${conversationId}`).flush({
      id: conversationId,
      customerId: 'cust-1',
      customerPhoneNumberE164: '+919999999999',
      customerName: 'Test Customer',
      mode: 'AI',
      status: 'Open',
      assignedAgentId: null,
      lastMessageAt: null,
      lastInboundMessageAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      closedAt: null,
      aiConfidenceLast: null,
      lastDetectedIntent: null,
      lastLeadScore: null,
      summary: null,
    });

    httpMock
      .expectOne((r) => r.url === `${environment.apiBaseUrl}/conversations/${conversationId}/messages`)
      .flush({ items: [], totalCount: 0, page: 1, pageSize: 30, totalPages: 0 });

    httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/users`).flush({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
    });

    httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/message-templates`).flush({
      items: [
        {
          id: 'tmpl-hello-world',
          name: 'hello_world',
          language: 'en_US',
          category: 'Utility',
          whatsAppTemplateName: 'hello_world',
          whatsAppTemplateStatus: 'Approved',
          bodyText: 'Hello World',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
    });

    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('defaults to Template mode and shows the template in the picker when the window is closed', () => {
    expect(fixture.componentInstance.composeForm.controls.mode.value).toBe('template');
    expect(fixture.componentInstance.approvedTemplates.map((t) => t.name)).toEqual(['hello_world']);
    expect(fixture.componentInstance.canSendText).toBeFalse();
  });

  it('sends the selected template and the Send button is not blocked once one is chosen', fakeAsync(() => {
    const component = fixture.componentInstance;

    // Simulate selecting "hello_world" the way the mat-select does — set the control's value.
    component.composeForm.controls.messageTemplateId.setValue('tmpl-hello-world');
    fixture.detectChanges();

    const sendButton: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(sendButton.disabled)
      .withContext('Send should be enabled once a template is selected')
      .toBeFalse();

    sendButton.click();
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiBaseUrl}/conversations/${conversationId}/messages`).flush({
      id: 'msg-1',
      direction: 'Outbound',
      messageType: 'Template',
      text: 'Hello World',
      templateName: 'hello_world',
      status: 'Sent',
      sentAt: '2026-01-01T00:05:00Z',
      deliveredAt: null,
      readAt: null,
      createdAt: '2026-01-01T00:05:00Z',
    });
    tick();
    flush();
  }));

  it('sends via a real click through the mat-select dropdown, not a direct form value set', fakeAsync(() => {
    const component = fixture.componentInstance;

    // The mat-select's disabled/enabled state, its overlay opening, and the option click all go
    // through Material's own CDK overlay + ControlValueAccessor machinery — setValue() in the test
    // above bypasses all of that, so this exercises the actual interaction path a real user takes.
    // Only one mat-select ever renders inside .compose-card at a time (Mode/Assign live in
    // .header-card instead), so this is unambiguous without needing a more specific selector.
    const templateSelectTrigger: HTMLElement = fixture.nativeElement.querySelector('.compose-card mat-select');
    expect(templateSelectTrigger).withContext('template mat-select should render').toBeTruthy();

    templateSelectTrigger.click();
    fixture.detectChanges();
    tick();

    const option = document.querySelector('mat-option') as HTMLElement | null;
    expect(option).withContext('hello_world option should appear in the opened panel').toBeTruthy();
    expect(option!.textContent).toContain('hello_world');

    option!.click();
    fixture.detectChanges();
    tick();
    flush();
    fixture.detectChanges();

    expect(fixture.componentInstance.composeForm.controls.messageTemplateId.value)
      .withContext('form control should reflect the real click, not just a programmatic setValue')
      .toBe('tmpl-hello-world');

    const sendButton: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(sendButton.disabled)
      .withContext('Send should be enabled after a real click-selected template, same as a programmatic one')
      .toBeFalse();

    sendButton.click();
    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/conversations/${conversationId}/messages`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: null, messageTemplateId: 'tmpl-hello-world' });

    req.flush({
      id: 'msg-1',
      direction: 'Outbound',
      messageType: 'Template',
      text: 'Hello World',
      templateName: 'hello_world',
      status: 'Sent',
      sentAt: '2026-01-01T00:05:00Z',
      deliveredAt: null,
      readAt: null,
      createdAt: '2026-01-01T00:05:00Z',
    });
    tick();
    flush();
    fixture.detectChanges();

    expect(component.messages.length).toBe(1);
    expect(component.sending).toBeFalse();
  }));
});

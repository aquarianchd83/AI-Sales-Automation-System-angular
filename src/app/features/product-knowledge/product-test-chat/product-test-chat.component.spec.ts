import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';

import { TestChatReply } from '../../../core/models/product-test-chat.model';
import { KnowledgeVersionsOverview } from '../../../core/models/published-knowledge.model';
import { ProductTestChatService } from '../../../core/services/product-test-chat.service';
import { PublishedKnowledgeService } from '../../../core/services/published-knowledge.service';
import { SharedModule } from '../../../shared/shared.module';
import { ProductTestChatComponent } from './product-test-chat.component';

const overview = (over: Partial<KnowledgeVersionsOverview> = {}): KnowledgeVersionsOverview =>
  ({ preview: {} as never, versions: [], chatUsesPublishedKnowledge: false, servingVersionNumber: 3, ...over });

const answer = (text: string, over: Partial<TestChatReply> = {}): TestChatReply => ({
  reply: text,
  outcome: 'Answered',
  why: 'Answered from 1 approved answer in version 3.',
  sources: [{ itemId: 'i1', versionNumber: 3, question: 'What is the fee?', excerpt: 'The fee is Rs 500.', relevance: 0.91, isMaterialClaim: true, cited: true }],
  draftBlocked: null,
  detectedIntent: 'PriceEnquiry',
  ...over,
});

describe('ProductTestChatComponent', () => {
  let fixture: ComponentFixture<ProductTestChatComponent>;
  let component: ProductTestChatComponent;
  let chat: jasmine.SpyObj<ProductTestChatService>;
  let published: jasmine.SpyObj<PublishedKnowledgeService>;

  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const all = (sel: string) => Array.from(fixture.nativeElement.querySelectorAll(sel)) as HTMLElement[];

  function create(o: KnowledgeVersionsOverview = overview()): void {
    published.get.and.returnValue(of(o));
    fixture = TestBed.createComponent(ProductTestChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function say(text: string): void {
    component.input.setValue(text);
    component.send();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    chat = jasmine.createSpyObj('ProductTestChatService', ['ask']);
    published = jasmine.createSpyObj('PublishedKnowledgeService', ['get']);
    await TestBed.configureTestingModule({
      declarations: [ProductTestChatComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ProductTestChatService, useValue: chat },
        { provide: PublishedKnowledgeService, useValue: published },
      ],
    }).compileComponents();
  });

  it('asks the tenant to publish first when nothing is live for chat', () => {
    create(overview({ servingVersionNumber: null }));

    expect(el('nothing-live')).not.toBeNull();
    expect(el('messages')).toBeNull();
  });

  it('says which version is being tested and whether live chat uses it yet', () => {
    create();
    expect(el('live-note')!.textContent).toContain('not switched over');
    expect(fixture.nativeElement.textContent).toContain('Testing version 3');

    fixture.destroy();
    create(overview({ chatUsesPublishedKnowledge: true }));
    expect(el('live-note')!.textContent).toContain('answered from this now');
  });

  it('tags the chat as connected with simulator only while the platform AI is the simulator', () => {
    create(overview({ platformAiSimulated: true }));
    expect(el('simulator-tag')!.textContent).toContain('Connected with simulator');

    fixture.destroy();
    create();
    expect(el('simulator-tag')).toBeNull();
  });

  it('tells the tester to carry on and contact the product owner when the platform AI is in test mode', () => {
    create();
    expect(el('platform-notice')).toBeNull();

    chat.ask.and.returnValue(of(answer('The fee is Rs 500.', { platformNotice: 'Please contact your product owner to finish the AI setup.' })));
    say('What is the fee?');

    expect(el('platform-notice')!.textContent).toContain('contact your product owner');
  });

  it('shows the customers message, a typing indicator while waiting, then the AIs reply with the time', () => {
    create();
    const pending = new Subject<TestChatReply>();
    chat.ask.and.returnValue(pending);

    say('What is the fee?');

    expect(all('[data-role="customer"]').length).toBe(1);
    expect(el('typing')).not.toBeNull();
    expect(component.input.value).toBe('');
    expect(el('send')!.hasAttribute('disabled')).toBeTrue();

    pending.next(answer('The fee is Rs 500. Is that for yourself?'));
    pending.complete();
    fixture.detectChanges();

    expect(el('typing')).toBeNull();
    expect(all('[data-role="assistant"]')[0].textContent).toContain('The fee is Rs 500. Is that for yourself?');
    expect(el('outcome')!.textContent).toContain('From your published knowledge');
  });

  it('sends the conversation so far with each turn, including what the server decided for the AIs turns', () => {
    create();
    chat.ask.and.returnValues(of(answer('Which country?', { outcome: 'Clarifying', sources: [] })), of(answer('Thanks.')));

    say('Do you arrange visas?');
    say('India');

    expect(chat.ask.calls.argsFor(0)).toEqual(['Do you arrange visas?', []]);
    expect(chat.ask.calls.argsFor(1)).toEqual([
      'India',
      [
        { role: 'customer', text: 'Do you arrange visas?' },
        { role: 'assistant', text: 'Which country?', kind: 'Clarifying' },
      ],
    ]);
    expect(all('[data-role="customer"]').length).toBe(2);
  });

  it('marks a question the AI had to ask because nothing published covers it', () => {
    create();
    chat.ask.and.returnValue(of(answer('Which treatment do you mean?', { outcome: 'Clarifying', sources: [] })));

    say('How much?');

    expect(el('outcome')!.textContent).toContain('nothing published covers this');
  });

  it('shows which approved answers were used when the tester asks why', () => {
    create();
    chat.ask.and.returnValue(of(answer('The fee is Rs 500.')));
    say('What is the fee?');
    expect(el('why')).toBeNull();

    el('why-toggle')!.click();
    fixture.detectChanges();

    const why = el('why')!.textContent!;
    expect(why).toContain('Answered from 1 approved answer in version 3.');
    expect(why).toContain('What is the fee?');
    expect(why).toContain('The fee is Rs 500.');
    expect(why).toContain('used');
    expect(why).toContain('Price, guarantee or result');
  });

  it('shows a hand-over as a note, not as something the AI said, with what it tried to say', () => {
    create();
    chat.ask.and.returnValue(
      of(answer('', { reply: null, outcome: 'HandedOver', why: 'The AI draft failed a safety check.', draftBlocked: 'We guarantee a cure. (no approved answer states it)', sources: [] }))
    );

    say('Will it cure me?');

    expect(all('[data-role="assistant"]').length).toBe(0);
    expect(el('handover')!.textContent).toContain('A person would take over here');
    expect(el('draft-blocked')!.textContent).toContain('We guarantee a cure.');
  });

  it('puts the question back when the AI could not answer, so it can be sent again', () => {
    create();
    chat.ask.and.returnValue(throwError(() => new Error('down')));

    say('What is the fee?');

    expect(all('[data-role="customer"]').length).toBe(0);
    expect(component.input.value).toBe('What is the fee?');
    expect(component.sending).toBeFalse();
  });

  it('sends on Enter and makes a new line on Shift+Enter', () => {
    create();
    chat.ask.and.returnValue(of(answer('Hi.')));
    component.input.setValue('Hello');

    component.onKey(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(chat.ask).not.toHaveBeenCalled();

    component.onKey(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(chat.ask).toHaveBeenCalled();
  });

  it('does not send an empty message', () => {
    create();
    component.input.setValue('   ');

    component.send();

    expect(chat.ask).not.toHaveBeenCalled();
    expect(el('send')!.hasAttribute('disabled')).toBeTrue();
  });

  it('starts over with a new conversation that remembers nothing', () => {
    create();
    chat.ask.and.returnValues(of(answer('One.')), of(answer('Two.')));
    say('First');

    el('reset')!.click();
    fixture.detectChanges();
    expect(el('empty')).not.toBeNull();

    say('Second');
    expect(chat.ask.calls.argsFor(1)).toEqual(['Second', []]);
  });
});

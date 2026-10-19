import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { DraftRun, KnowledgeAnswer, KnowledgeAnswersOverview, KnowledgeQuestion } from '../../../core/models/product-answers.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ProductAnswersService } from '../../../core/services/product-answers.service';
import { SharedModule } from '../../../shared/shared.module';
import { POLL_MS, ProductAnswersComponent } from './product-answers.component';

const answer = (over: Partial<KnowledgeAnswer> = {}): KnowledgeAnswer => ({
  id: 'a1',
  version: 1,
  summary: 'The consultation fee is Rs 500 for the first visit.',
  detail: null,
  kind: 'SourceExtracted',
  confidence: 'High',
  status: 'PendingVerification',
  limitation: null,
  clarifyingQuestion: null,
  reasons: ['1 verified quotation from 1 passage; they cover 100% of the answer.'],
  isMaterialClaim: true,
  hasUnsupportedClaim: false,
  hasConflict: false,
  provider: 'OpenAI',
  model: 'gpt',
  isSimulated: false,
  generatedAt: '2026-10-19T09:00:00Z',
  evidence: [{ sourceId: 's', sourceName: 'brochure.pdf', location: 'Page 2', heading: 'Pricing', excerpt: 'consultation fee is Rs 500 for the first visit' }],
  conflicts: [],
  ...over,
});

const question = (over: Partial<KnowledgeQuestion> = {}): KnowledgeQuestion => ({
  id: 'q1',
  key: 'main-benefit',
  text: 'What is the main benefit of your product?',
  isStandard: true,
  category: 'Benefits',
  sortOrder: 0,
  answer: answer(),
  ...over,
});

const overview = (over: Partial<KnowledgeAnswersOverview> = {}): KnowledgeAnswersOverview => ({
  questions: [question(), question({ id: 'q2', key: 'saves', text: 'How does it save time?', answer: null })],
  features: [],
  run: null,
  readySources: 2,
  passages: 30,
  aiMode: 'Api',
  aiProvider: 'OpenAI',
  maxCustomQuestions: 3,
  customQuestions: 0,
  ...over,
});

const run = (over: Partial<DraftRun> = {}): DraftRun => ({
  id: 'r1', status: 'Running', total: 13, done: 4, drafted: 3, noEvidence: 1, skipped: 0, failed: 0, error: null, createdAt: '', startedAt: '', finishedAt: null, ...over,
});

describe('ProductAnswersComponent', () => {
  let fixture: ComponentFixture<ProductAnswersComponent>;
  let api: jasmine.SpyObj<ProductAnswersService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (sel: string) => (root().querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(initial: KnowledgeAnswersOverview): ProductAnswersComponent {
    api = jasmine.createSpyObj('ProductAnswersService', ['get', 'startDraft', 'redraft', 'ask', 'removeQuestion']);
    api.get.and.returnValue(of(initial));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      declarations: [ProductAnswersComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ProductAnswersService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
      ],
    });
    fixture = TestBed.createComponent(ProductAnswersComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => fixture?.destroy());

  it('shows the answer with its confidence, its separate verification status and the exact words that back it', () => {
    render(overview());

    expect(text('[data-testid="summary"]')).toBe('The consultation fee is Rs 500 for the first visit.');
    expect(text('[data-testid="confidence"]')).toBe('High confidence');
    expect(text('[data-testid="verification"]')).toBe('Waiting for your check'); // High, and still not approved
    expect(root().textContent).toContain('Needs your approval'); // a price is a material claim
    const evidence = text('[data-testid="evidence"]');
    expect(evidence).toContain('"consultation fee is Rs 500 for the first visit"');
    expect(evidence).toContain('brochure.pdf · Page 2 · Pricing');
  });

  it('lists every question with its confidence, and shows an undrafted one as not drafted with a way to suggest an answer', () => {
    const component = render(overview());

    expect(text('[data-question="q1"]')).toContain('High');
    expect(text('[data-question="q2"]')).toContain('Not drafted');
    root().querySelector<HTMLButtonElement>('[data-question="q2"]')!.click();
    fixture.detectChanges();

    expect(component.selectedId).toBe('q2');
    expect(root().querySelector('[data-testid="not-drafted"]')).not.toBeNull();
  });

  it('shows an unanswerable question as what the sources lack and the one thing to ask the tenant - not as an answer', () => {
    render(overview({ questions: [question({ answer: answer({ summary: null, confidence: 'NoEvidence', limitation: 'None of your sources mention this.', clarifyingQuestion: 'What is the fee?', isMaterialClaim: false, evidence: [], reasons: [] }) })] }));

    expect(root().querySelector('[data-testid="summary"]')).toBeNull();
    expect(text('[data-testid="no-answer"]')).toContain('None of your sources mention this.');
    expect(text('[data-testid="clarify"]')).toContain('What is the fee?');
    expect(text('[data-testid="confidence"]')).toBe('No supporting evidence');
  });

  it('keeps a long answer short until asked, and explains how the confidence was judged on request', () => {
    const component = render(overview({ questions: [question({ answer: answer({ detail: '- Faster records\n- Fewer errors' }) })] }));

    expect(root().querySelector('[data-testid="detail"]')).toBeNull();
    component.toggle('a1');
    fixture.detectChanges();
    expect(text('[data-testid="detail"]')).toContain('Faster records');

    expect(root().querySelector('[data-testid="reasons"]')).toBeNull();
    component.toggle('why-a1');
    fixture.detectChanges();
    expect(text('[data-testid="reasons"]')).toContain('not from how sure the AI sounded');
  });

  it('shows both values and where each came from when sources disagree, and does not pick one', () => {
    render(overview({
      questions: [question({ answer: answer({
        confidence: 'Low', hasConflict: true, limitation: 'Your sources disagree about the price.',
        conflicts: [{ id: 'c', fact: 'price', status: 'Open', values: [
          { value: '999', sourceName: 'brochure.pdf', location: 'Page 2', sentence: 'The Premium Plan costs Rs 999.' },
          { value: '1499', sourceName: 'clinic.example', location: 'https://clinic.example/pricing', sentence: 'The Premium Plan costs Rs 1,499.' },
        ] }],
      }) })],
    }));

    const conflict = text('[data-testid="conflict"]');
    expect(conflict).toContain('disagree about the price');
    expect(conflict).toContain('999');
    expect(conflict).toContain('1499');
    expect(conflict).toContain('brochure.pdf · Page 2');
    expect(conflict).toContain('Neither is chosen for you');
  });

  it('flags a test-mode answer as test data and explains the simulator at the top', () => {
    render(overview({ aiMode: 'Simulator', aiProvider: 'Simulator', questions: [question({ answer: answer({ isSimulated: true, summary: null, confidence: 'NoEvidence', limitation: 'Simulated test data.' }) })] }));

    expect(root().querySelector('[data-testid="simulator"]')).not.toBeNull();
    expect(root().textContent).toContain('Test data');
  });

  it('cannot draft when the platform has it switched off or there is nothing read, and says why', () => {
    const off = render(overview({ aiMode: 'Off' }));
    expect(root().querySelector('[data-testid="off"]')).not.toBeNull();
    expect(off.canDraft).toBeFalse();
    expect((root().querySelector('[data-testid="draft"]') as HTMLButtonElement).disabled).toBeTrue();
    fixture.destroy();
    TestBed.resetTestingModule();

    const none = render(overview({ readySources: 0 }));
    expect(none.canDraft).toBeFalse();
    expect(text('[data-testid="no-sources"]')).toContain('Product sources');
  });

  it('starts a run and follows its progress until it finishes, then says what it did', fakeAsync(() => {
    const component = render(overview());
    api.startDraft.and.returnValue(of(run({ status: 'Queued', done: 0 })));
    api.get.and.returnValue(of(overview({ run: run() })));

    component.draft();
    fixture.detectChanges();
    expect(component.running).toBeTrue();
    expect(text('[data-testid="draft"]')).toContain('Drafting…');

    tick(POLL_MS);
    fixture.detectChanges();
    expect(text('[data-testid="run"]')).toContain('4 of 13');

    api.get.and.returnValue(of(overview({ run: run({ status: 'Completed', done: 13, drafted: 10, noEvidence: 3, finishedAt: '2026-10-19T09:05:00Z' }) })));
    tick(POLL_MS);
    fixture.detectChanges();
    expect(component.running).toBeFalse();
    expect(notify.success).toHaveBeenCalledWith('Drafting finished: 10 answered from your sources, 3 need more information.');
    expect(text('[data-testid="run"]')).toContain('10 answered · 3 need more information');

    api.get.calls.reset();
    tick(POLL_MS * 3);
    expect(api.get).not.toHaveBeenCalled(); // polling stopped
    discardPeriodicTasks();
  }));

  it('asks for another suggestion for one question and shows the new version', () => {
    const component = render(overview());
    api.redraft.and.returnValue(of(question({ answer: answer({ id: 'a2', version: 2, summary: 'A second suggestion.' }) })));

    root().querySelector<HTMLButtonElement>('[data-testid="redraft"]')!.click();
    fixture.detectChanges();

    expect(api.redraft).toHaveBeenCalledWith('q1');
    expect(component.questions[0].answer!.version).toBe(2);
    expect(text('[data-testid="summary"]')).toBe('A second suggestion.');
  });

  it('adds the tenants own question with its answer, limits them, and removes one on confirmation', () => {
    const component = render(overview());
    const created = question({ id: 'own', key: null, isStandard: false, text: 'Do you offer a free trial?', category: 'Custom', answer: answer({ id: 'a9' }) });
    api.ask.and.returnValue(of(created));

    component.question.setValue('Do you offer a free trial?');
    component.ask();
    fixture.detectChanges();

    expect(api.ask).toHaveBeenCalledWith('Do you offer a free trial?');
    expect(component.selectedId).toBe('own');
    expect(component.question.value).toBe('');
    expect(text('[data-question="own"]')).toContain('Your question');

    api.removeQuestion.and.returnValue(of(undefined));
    root().querySelector<HTMLButtonElement>('[data-testid="remove"]')!.click();
    expect(api.removeQuestion).toHaveBeenCalledWith('own');
    expect(component.questions.some((q) => q.id === 'own')).toBeFalse();
  });

  it('refuses a question that is too short and stops at the limit', () => {
    const component = render(overview({ customQuestions: 3 }));

    component.question.setValue('Why?');
    component.ask();
    expect(api.ask).not.toHaveBeenCalled();

    expect(component.canAsk).toBeFalse();
    expect(root().textContent).toContain('You have asked the most questions allowed (3)');
  });

  it('lists the features and benefits with their evidence and flags an unproven number', () => {
    const component = render(overview({
      features: [{
        id: 'f', feature: 'Online billing', problem: 'Slow manual billing', benefit: 'Bills are sent faster', segment: 'Clinics', confidence: 'Low', hasUnsupportedClaim: true,
        evidence: [{ sourceId: 's', sourceName: 'brochure.pdf', location: 'Page 3', heading: null, excerpt: 'online billing for the clinic' }], provider: 'OpenAI', isSimulated: false, generatedAt: '',
      }],
    }));

    root().querySelector<HTMLButtonElement>('[data-testid="features-item"]')!.click();
    fixture.detectChanges();

    expect(component.selectedId).toBe('features');
    const feature = text('[data-testid="feature"]');
    expect(feature).toContain('Online billing');
    expect(feature).toContain('Unproven number');
    expect(feature).toContain('"online billing for the clinic"');
    expect(text('[data-testid="features-item"]')).toContain('1 found');
  });

  it('says so when the answers cannot be loaded', () => {
    api = jasmine.createSpyObj('ProductAnswersService', ['get']);
    api.get.and.returnValue(throwError(() => new Error('500')));
    TestBed.configureTestingModule({
      declarations: [ProductAnswersComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ProductAnswersService, useValue: api },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']) },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
      ],
    });
    fixture = TestBed.createComponent(ProductAnswersComponent);
    fixture.detectChanges();

    expect(root().textContent).toContain('could not be loaded');
  });
});

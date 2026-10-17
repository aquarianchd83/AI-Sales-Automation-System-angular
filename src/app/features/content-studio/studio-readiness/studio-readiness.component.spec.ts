import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { BusinessFact, ClaimCheckResult, ContentTypeReadiness, KnowledgeGap, KnowledgeReadiness } from '../../../core/models/content-studio.model';
import { AppRole } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { StudioReadinessComponent } from './studio-readiness.component';

const gap = (key: string, over: Partial<KnowledgeGap> = {}): KnowledgeGap => ({
  key,
  label: `Gap ${key}`,
  reason: 'Missing',
  state: 'Open',
  deferredUntilUtc: null,
  question: `Question ${key}?`,
  why: `Because ${key}.`,
  example: null,
  requiresEvidence: false,
  skippable: false,
  neededFor: ['Offers and pricing'],
  factsToConfirm: [],
  factsInvolved: [],
  ...over,
});

const type = (key: string, over: Partial<ContentTypeReadiness> = {}): ContentTypeReadiness => ({
  key,
  label: `Type ${key}`,
  description: 'About it',
  score: 40,
  minScore: 70,
  status: 'NotReady',
  summary: 'Not ready: still needs "Your prices".',
  requirements: [
    { key: 'pricing', label: 'Your prices', weight: 30, critical: true, fulfilment: 0, points: 0, state: 'Missing', explanation: 'Nothing about this yet.', factIds: [] },
    { key: 'identity', label: 'What the business is', weight: 20, critical: false, fulfilment: 1, points: 20, state: 'Met', explanation: '1 verified fact backs this.', factIds: ['f1'] },
  ],
  ...over,
});

const readiness = (over: Partial<KnowledgeReadiness> = {}): KnowledgeReadiness => ({
  overallScore: 42,
  contentTypes: [type('offers_pricing'), type('general_education', { status: 'Ready', score: 90, summary: 'Ready: the facts this needs are verified.' })],
  gaps: [gap('pricing')],
  facts: { verified: 3, needsChecking: 2, expired: 1, retired: 0 },
  rulesWarning: null,
  evaluatedAtUtc: '2026-10-17T09:00:00Z',
  ...over,
});

describe('StudioReadinessComponent', () => {
  let fixture: ComponentFixture<StudioReadinessComponent>;
  let studio: jasmine.SpyObj<ContentStudioService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const root = () => fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    (root().querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };

  function render(initial: KnowledgeReadiness, role: AppRole = AppRole.Admin): HTMLElement {
    studio = jasmine.createSpyObj('ContentStudioService', ['getReadiness', 'answerGap', 'skipGap', 'deferGap', 'reopenGap', 'verifyFact', 'checkClaims']);
    studio.getReadiness.and.returnValue(of(initial));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      declarations: [StudioReadinessComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ContentStudioService, useValue: studio },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: { hasAnyRole: (roles: string[]) => roles.includes(role) } },
      ],
    });
    fixture = TestBed.createComponent(StudioReadinessComponent);
    fixture.detectChanges();
    return root();
  }

  it('shows the overall score and what is verified, waiting and out of date', () => {
    const el = render(readiness());

    const overview = text(el.querySelector('[data-testid="overview"]'));
    expect(overview).toContain('42');
    expect(overview).toContain('3 verified');
    expect(overview).toContain('2 waiting to be checked');
    expect(overview).toContain('1 out of date');
    expect(overview).toContain('not how many questions you answered');
  });

  it('shows each kind of content with its score, its threshold and a plain status', () => {
    const el = render(readiness());

    const pricing = el.querySelector('[data-type="offers_pricing"]')!;
    expect(text(pricing)).toContain('Not ready yet');
    expect(text(pricing)).toContain('40 / 100 · needs 70');
    expect(text(pricing)).toContain('still needs "Your prices"');
    expect((pricing.querySelector('.meter-fill') as HTMLElement).style.width).toBe('40%');
    expect((pricing.querySelector('.meter-threshold') as HTMLElement).style.left).toBe('70%');

    expect(text(el.querySelector('[data-type="general_education"]'))).toContain('Ready');
    expect(el.querySelector('[data-type="general_education"] .meter-fill--ready')).not.toBeNull();
  });

  it('explains a score on request: each requirement, its state and its points, with the must-haves marked', () => {
    const el = render(readiness());
    expect(el.querySelector('[data-type="offers_pricing"] .reqs')).toBeNull();

    click('[data-type="offers_pricing"] .why');

    const rows = Array.from(el.querySelectorAll('[data-type="offers_pricing"] [data-req]'));
    expect(rows.length).toBe(2);
    expect(text(rows[0])).toContain('Your prices');
    expect(text(rows[0])).toContain('must have');
    expect(text(rows[0])).toContain('Missing');
    expect(text(rows[0])).toContain('Nothing about this yet.');
    expect(text(rows[0])).toContain('0 / 30');
    expect(text(rows[1])).toContain('Done');
    expect(text(rows[1])).toContain('20 / 20');

    click('[data-type="offers_pricing"] .why');
    expect(el.querySelector('[data-type="offers_pricing"] .reqs')).toBeNull();
  });

  // ----- the follow-up questions ---------------------------------------------------------------------------------------------------

  it('asks each open gap as a simple question, with why it is needed and what it unlocks', () => {
    const el = render(readiness({ gaps: [gap('pricing', { example: 'Consultation Rs 500' })] }));

    const card = el.querySelector('[data-gap="pricing"]')!;
    expect(text(card)).toContain('Question pricing?');
    expect(text(card)).toContain('Because pricing.');
    expect(text(card)).toContain('Needed for: Offers and pricing');
    expect(text(card)).toContain('We need this');
  });

  it('says there is nothing more to ask when there are no gaps', () => {
    const el = render(readiness({ gaps: [] }));

    expect(text(el.querySelector('.empty-card'))).toContain('Nothing more to ask');
  });

  it('opens the answer form in place, records the answer, and shows the recalculated score', () => {
    const el = render(readiness({ gaps: [gap('pricing', { example: 'Consultation Rs 500' })] }));
    studio.answerGap.and.returnValue(of(readiness({ overallScore: 55, gaps: [gap('pricing', { reason: 'NeedsConfirmation', factsToConfirm: ['f9'] })] })));

    click('[data-gap="pricing"] .answer-gap');
    const save = el.querySelector('[data-gap="pricing"] .save-answer') as HTMLButtonElement;
    expect(save.disabled).toBeTrue();
    expect((el.querySelector('[data-gap="pricing"] textarea') as HTMLTextAreaElement).placeholder).toContain('Consultation Rs 500');

    fixture.componentInstance.answer.setValue('Groceries from Rs 10.');
    fixture.componentInstance.context.setValue('Pune store');
    fixture.detectChanges();
    expect(save.disabled).toBeFalse();
    save.click();
    fixture.detectChanges();

    expect(studio.answerGap).toHaveBeenCalledWith('pricing', { answer: 'Groceries from Rs 10.', evidence: null, context: 'Pune store' });
    expect(notify.success).toHaveBeenCalled();
    expect(text(el.querySelector('[data-testid="overview"]'))).toContain('55');
    expect(el.querySelector('[data-gap="pricing"] .answer-form')).toBeNull();
    expect(text(el.querySelector('[data-gap="pricing"]'))).toContain('Waiting to be confirmed');
  });

  it('will not save an empty answer, and needs proof where the claim needs it', () => {
    const el = render(readiness({ gaps: [gap('customer_results', { requiresEvidence: true })] }));
    click('[data-gap="customer_results"] .answer-gap');
    const component = fixture.componentInstance;
    const claim = component.openGaps[0];

    expect(component.canSubmit(claim)).toBeFalse();
    component.answer.setValue('Vision improved.');
    expect(component.canSubmit(claim)).toBeFalse(); // the proof is missing
    expect(text(el.querySelector('[data-gap="customer_results"]'))).toContain('How can you prove it?');

    component.evidence.setValue('Signed report');
    expect(component.canSubmit(claim)).toBeTrue();
  });

  it('asks only for the proof when the fact is already there and just lacks it', () => {
    const el = render(readiness({ gaps: [gap('customer_results', { reason: 'NeedsEvidence', requiresEvidence: true, factsInvolved: ['f1'] })] }));
    studio.answerGap.and.returnValue(of(readiness({ gaps: [] })));

    click('[data-gap="customer_results"] .answer-gap');
    expect(text(el.querySelector('[data-gap="customer_results"]'))).toContain('Needs proof');
    expect(el.querySelector('[data-gap="customer_results"] textarea[placeholder^="e.g. Signed"]')).not.toBeNull();
    expect(Array.from(el.querySelectorAll('[data-gap="customer_results"] mat-label')).map((l) => text(l))).toEqual(['How can you prove it?']);

    const component = fixture.componentInstance;
    component.evidence.setValue('Signed outcome report');
    component.submit(component.openGaps[0]);

    expect(studio.answerGap).toHaveBeenCalledWith('customer_results', { answer: '', evidence: 'Signed outcome report', context: null });
  });

  it('lets an unneeded question be skipped, but only where the rules allow it', () => {
    const el = render(readiness({ gaps: [gap('brand_voice', { skippable: true }), gap('pricing')] }));
    studio.skipGap.and.returnValue(of(readiness({ gaps: [gap('pricing')] })));

    expect(el.querySelector('[data-gap="pricing"] .skip-gap')).toBeNull();
    click('[data-gap="brand_voice"] .skip-gap');

    expect(studio.skipGap).toHaveBeenCalledWith('brand_voice');
    expect(el.querySelector('[data-gap="brand_voice"]')).toBeNull();
  });

  it('puts a question off, and brings it back on request', () => {
    const el = render(readiness({ gaps: [gap('pricing')] }));
    studio.deferGap.and.returnValue(of(readiness({ gaps: [gap('pricing', { state: 'Deferred', deferredUntilUtc: '2026-10-24T09:00:00Z' })] })));

    click('[data-gap="pricing"] .later-gap');
    expect(studio.deferGap).toHaveBeenCalledWith('pricing', null);
    expect(el.querySelector('[data-gap="pricing"]')).toBeNull();

    click('.deferred-toggle');
    expect(text(el.querySelector('.deferred'))).toContain('Gap pricing');

    studio.reopenGap.and.returnValue(of(readiness({ gaps: [gap('pricing')] })));
    (el.querySelector('.deferred button') as HTMLElement).click();
    fixture.detectChanges();

    expect(studio.reopenGap).toHaveBeenCalledWith('pricing');
    expect(el.querySelector('[data-gap="pricing"]')).not.toBeNull();
  });

  // ----- confirming what the tenant has told us -------------------------------------------------------------------------------------

  it('lets an admin confirm the facts that fill a gap in one click, then recalculates', () => {
    const el = render(readiness({ gaps: [gap('pricing', { reason: 'NeedsConfirmation', factsToConfirm: ['f1', 'f2'] })] }));
    studio.verifyFact.and.returnValue(of({} as BusinessFact));

    const button = el.querySelector('[data-gap="pricing"] .verify-gap') as HTMLElement;
    expect(text(button)).toContain('Verify 2 facts');
    button.click();

    expect(studio.verifyFact).toHaveBeenCalledWith('f1');
    expect(studio.verifyFact).toHaveBeenCalledWith('f2');
    expect(studio.getReadiness).toHaveBeenCalledTimes(2);
  });

  it('confirms again, not for the first time, a fact that has gone out of date', () => {
    const el = render(readiness({ gaps: [gap('pricing', { reason: 'Expired', factsToConfirm: ['f1'] })] }));
    studio.verifyFact.and.returnValue(of({} as BusinessFact));

    const button = el.querySelector('[data-gap="pricing"] .verify-gap') as HTMLElement;
    expect(text(button)).toContain('Confirm again');
    expect(el.querySelector('[data-gap="pricing"] .answer-gap')).toBeNull();
    button.click();

    expect(studio.verifyFact).toHaveBeenCalledWith('f1', true);
  });

  it('gives a sales manager no verify button, and says an admin has to confirm', () => {
    const el = render(readiness({ gaps: [gap('pricing', { reason: 'NeedsConfirmation', factsToConfirm: ['f1'] })] }), AppRole.SalesManager);

    expect(el.querySelector('.verify-gap')).toBeNull();
    expect(text(el.querySelector('[data-gap="pricing"]'))).toContain('An Admin needs to confirm');
    fixture.componentInstance.verify(fixture.componentInstance.openGaps[0]);
    expect(studio.verifyFact).not.toHaveBeenCalled();
  });

  // ----- checking a sentence -----------------------------------------------------------------------------------------------------

  describe('check a claim', () => {
    const result: ClaimCheckResult = {
      supported: 1,
      flagged: 1,
      claims: [
        { claim: 'We perform cataract surgery.', verdict: 'Supported', reason: 'Matches a fact you have verified.', supportingFactIds: ['f1'], isRisky: false },
        { claim: '98% of patients see better.', verdict: 'Unsupported', reason: 'None of your facts supports this.', supportingFactIds: [], isRisky: true },
      ],
    };

    it('stays closed until opened, sends one claim per line, and shows what each one has going for it', () => {
      const el = render(readiness());
      studio.checkClaims.and.returnValue(of(result));
      expect(el.querySelector('.claims textarea')).toBeNull();

      click('.claims-toggle');
      fixture.componentInstance.claims.setValue('We perform cataract surgery.\n\n  98% of patients see better.  \n');
      fixture.detectChanges();
      click('.check-claims');

      expect(studio.checkClaims).toHaveBeenCalledWith(['We perform cataract surgery.', '98% of patients see better.']);
      const rows = Array.from(el.querySelectorAll('.claim-results li')).map((li) => text(li));
      expect(rows[0]).toContain('Backed by a verified fact');
      expect(rows[1]).toContain('Nothing backs this');
      expect(rows[1]).toContain('sounds like a result or guarantee');
    });

    it('does nothing when there is nothing to check', () => {
      render(readiness());
      click('.claims-toggle');

      expect((root().querySelector('.check-claims') as HTMLButtonElement).disabled).toBeTrue();
      fixture.componentInstance.checkClaims();
      expect(studio.checkClaims).not.toHaveBeenCalled();
    });
  });
});

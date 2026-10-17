import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  BusinessFact,
  BusinessFactChangeKind,
  BusinessFactOrigin,
  BusinessFactSource,
  BusinessFactStatus,
  KnowledgeClassification,
} from '../../../core/models/content-studio.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { AppRole } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { StudioFactsComponent } from './studio-facts.component';

const fact = (id: string, over: Partial<BusinessFact> = {}): BusinessFact => ({
  id,
  category: 'Services',
  statement: `Fact ${id}`,
  sourceType: BusinessFactSource.Manual,
  sourceRef: null,
  status: BusinessFactStatus.Draft,
  verifiedBy: null,
  verifiedByName: null,
  verifiedAtUtc: null,
  createdAt: '2026-10-10T08:00:00Z',
  updatedAt: null,
  subject: null,
  context: null,
  evidence: null,
  origin: BusinessFactOrigin.TenantProvided,
  classification: KnowledgeClassification.TenantProvided,
  expiresAtUtc: null,
  reviewEveryDays: null,
  ...over,
});

/** A fact a person confirmed, with the classification the server would give it. */
const verified = (id: string, over: Partial<BusinessFact> = {}): BusinessFact =>
  fact(id, { status: BusinessFactStatus.Verified, classification: KnowledgeClassification.TenantApproved, verifiedAtUtc: '2026-10-11T08:00:00Z', ...over });

describe('StudioFactsComponent', () => {
  let fixture: ComponentFixture<StudioFactsComponent>;
  let studio: jasmine.SpyObj<ContentStudioService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(rows: BusinessFact[], role: AppRole = AppRole.Admin): HTMLElement {
    studio = jasmine.createSpyObj('ContentStudioService', [
      'getFacts',
      'getFactSummary',
      'createFact',
      'updateFact',
      'updateFactDetails',
      'getFactHistory',
      'verifyFact',
      'retireFact',
    ]);
    studio.getFactHistory.and.returnValue(of([]));
    studio.getFacts.and.returnValue(of({ ...emptyPage<BusinessFact>(), items: rows, totalCount: rows.length, totalPages: 1 }));
    studio.getFactSummary.and.returnValue(of({ draft: 2, verified: 1, retired: 0, categories: ['Contact', 'Services'] }));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);

    TestBed.configureTestingModule({
      declarations: [StudioFactsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ContentStudioService, useValue: studio },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: { hasAnyRole: (roles: string[]) => roles.includes(role) } },
      ],
    });
    fixture = TestBed.createComponent(StudioFactsComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const rowsOf = (el: HTMLElement) => Array.from(el.querySelectorAll('tr.fact-row'));

  it('lists the facts with their status and counts what needs checking', () => {
    const el = render([fact('a'), fact('b', { status: BusinessFactStatus.Verified })]);

    expect(rowsOf(el).length).toBe(2);
    expect(text(rowsOf(el)[0])).toContain('Needs checking');
    expect(text(rowsOf(el)[1])).toContain('Verified');
    expect(text(el.querySelector('.summary'))).toContain('2 need checking');
  });

  it('opens the chosen fact beside the list without leaving the page', () => {
    const el = render([fact('a'), fact('b')]);
    expect(el.querySelector('.detail-card')).toBeNull();

    (rowsOf(el)[1] as HTMLElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.detail-card')).not.toBeNull();
    expect(fixture.componentInstance.statement.value).toBe('Fact b');
    expect(el.querySelector('.split')?.classList).toContain('split--detail');
  });

  it('filters by status from the counts, and back again', () => {
    render([fact('a')]);
    studio.getFacts.calls.reset();

    fixture.componentInstance.setStatus(BusinessFactStatus.Draft);
    expect(studio.getFacts.calls.mostRecent().args[0].status).toBe(BusinessFactStatus.Draft);
    expect(studio.getFacts.calls.mostRecent().args[0].page).toBe(1);

    fixture.componentInstance.setStatus(BusinessFactStatus.Draft);
    expect(studio.getFacts.calls.mostRecent().args[0].status).toBeNull();
  });

  it('lets an admin verify a fact that needs checking, straight from the list', () => {
    const el = render([fact('a')]);
    studio.verifyFact.and.returnValue(of(fact('a', { status: BusinessFactStatus.Verified })));

    (el.querySelector('.verify-button') as HTMLElement).click();

    expect(studio.verifyFact).toHaveBeenCalledWith('a');
    expect(notify.success).toHaveBeenCalledWith('Marked as verified.');
  });

  it('gives a sales manager no way to verify, and says why', () => {
    const el = render([fact('a')], AppRole.SalesManager);
    expect(el.querySelector('.verify-button')).toBeNull();

    (rowsOf(el)[0] as HTMLElement).click();
    fixture.detectChanges();

    expect(text(el.querySelector('.detail-card'))).toContain('Only an admin can verify a fact');
    fixture.componentInstance.verify(fact('a'));
    expect(studio.verifyFact).not.toHaveBeenCalled();
  });

  it('does not offer to verify a fact that is already verified or retired', () => {
    const el = render([fact('a', { status: BusinessFactStatus.Verified }), fact('b', { status: BusinessFactStatus.Retired })]);

    expect(el.querySelector('.verify-button')).toBeNull();
  });

  it('keeps a questionnaire fact read-only and points to the questionnaire', () => {
    const el = render([fact('q', { sourceType: BusinessFactSource.Questionnaire, sourceRef: 'business_name' })]);

    (rowsOf(el)[0] as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.editable).toBeFalse();
    expect((el.querySelector('.detail-card textarea') as HTMLTextAreaElement).readOnly).toBeTrue();
    expect(text(el.querySelector('.detail-card'))).toContain('update your answer');
  });

  it('saves an edit to a fact the tenant wrote, only once something changed', () => {
    render([fact('a')]);
    const component = fixture.componentInstance;
    studio.updateFact.and.returnValue(of(fact('a', { statement: 'Changed' })));

    component.open(fact('a'));
    component.save();
    expect(studio.updateFact).not.toHaveBeenCalled();

    component.statement.setValue('Changed');
    component.save();

    expect(studio.updateFact).toHaveBeenCalledWith('a', {
      category: 'Services',
      statement: 'Changed',
      subject: null,
      context: null,
      evidence: null,
      expiresAtUtc: null,
    });
  });

  it('warns that changing a verified fact means verifying it again', () => {
    const el = render([fact('a', { status: BusinessFactStatus.Verified })]);

    (rowsOf(el)[0] as HTMLElement).click();
    fixture.detectChanges();

    expect(text(el.querySelector('.detail-card'))).toContain('has to be verified again');
  });

  it('adds a new fact, which then needs checking', () => {
    const el = render([]);
    const component = fixture.componentInstance;
    studio.createFact.and.returnValue(of(fact('n', { statement: 'We are in Delhi.', category: 'Contact' })));

    component.startNew();
    fixture.detectChanges();
    expect(text(el.querySelector('.detail-card'))).toContain('Add a fact');
    expect(component.dirty).toBeFalse();

    component.category.setValue('Contact');
    component.statement.setValue('We are in Delhi.');
    expect(component.dirty).toBeTrue();
    component.save();

    expect(studio.createFact).toHaveBeenCalledWith({
      category: 'Contact',
      statement: 'We are in Delhi.',
      subject: null,
      context: null,
      evidence: null,
      expiresAtUtc: null,
    });
    expect(notify.success).toHaveBeenCalled();
  });

  it('retires a fact', () => {
    render([fact('a')]);
    studio.retireFact.and.returnValue(of(fact('a', { status: BusinessFactStatus.Retired })));

    fixture.componentInstance.open(fact('a'));
    fixture.componentInstance.retire(fact('a'));

    expect(studio.retireFact).toHaveBeenCalledWith('a');
  });

  it('explains an empty list, and an empty filtered list differently', () => {
    const el = render([]);
    expect(text(el.querySelector('.empty-state'))).toContain('No facts yet');

    fixture.componentInstance.statusFilter = BusinessFactStatus.Verified;
    fixture.detectChanges();
    expect(text(el.querySelector('.empty-state'))).toContain('Nothing matches');
  });

  // ----- what a fact is worth, where it came from, and what happened to it --------------------------------------------------------------

  describe('knowledge', () => {
    const open = (el: HTMLElement, index = 0) => {
      (rowsOf(el)[index] as HTMLElement).click();
      fixture.detectChanges();
    };

    it('says a fact is out of date, not just "verified", once its date has passed', () => {
      const el = render([verified('a', { classification: KnowledgeClassification.Expired, expiresAtUtc: '2026-10-01T23:59:59Z' })]);

      expect(text(rowsOf(el)[0])).toContain('Out of date');
      expect(el.querySelector('.status--expired')).not.toBeNull();
    });

    it('marks an AI suggestion as an unverified claim', () => {
      const el = render([fact('a', { origin: BusinessFactOrigin.AiInferred, classification: KnowledgeClassification.UnverifiedClaim })]);

      expect(text(rowsOf(el)[0])).toContain('Unverified claim');

      open(el);
      expect(text(el.querySelector('[data-testid="source"]'))).toContain('Suggested by an AI model');
      expect(text(el.querySelector('[data-testid="classification-hint"]'))).toContain('never used until an Admin confirms');
    });

    it('lets an admin confirm an out-of-date fact again, which re-stamps it rather than treating it as new', () => {
      const el = render([verified('a', { classification: KnowledgeClassification.Expired })]);
      studio.verifyFact.and.returnValue(of(verified('a')));

      const button = el.querySelector('.verify-button') as HTMLElement;
      expect(text(button)).toBe('Confirm again');
      button.click();

      expect(studio.verifyFact).toHaveBeenCalledWith('a', true);
      expect(notify.success).toHaveBeenCalledWith('Confirmed again.');
    });

    it('offers no confirmation for a fact that is verified and current', () => {
      const el = render([verified('a')]);

      expect(el.querySelector('.verify-button')).toBeNull();
    });

    it('filters to the facts that are out of date', () => {
      render([verified('a')]);
      studio.getFacts.calls.reset();

      fixture.componentInstance.setOutOfDate();
      expect(studio.getFacts.calls.mostRecent().args[0].classification).toBe(KnowledgeClassification.Expired);

      fixture.componentInstance.setOutOfDate();
      expect(studio.getFacts.calls.mostRecent().args[0].classification).toBeNull();
    });

    it('says where a fact came from', () => {
      const el = render([
        fact('q', { sourceType: BusinessFactSource.Questionnaire, sourceRef: 'x' }),
        fact('f', { sourceType: BusinessFactSource.FollowUp }),
        fact('m'),
      ]);

      open(el, 0);
      expect(text(el.querySelector('[data-testid="source"]'))).toContain('questionnaire');
      open(el, 1);
      expect(text(el.querySelector('[data-testid="source"]'))).toContain('follow-up question');
      open(el, 2);
      expect(text(el.querySelector('[data-testid="source"]'))).toContain('Added by you');
    });

    it('shows the fact\'s history in place, newest first, with the reason for each change', () => {
      const el = render([verified('a')]);
      studio.getFactHistory.and.returnValue(
        of([
          { number: 3, kind: BusinessFactChangeKind.Invalidated, category: 'Services', subject: null, statement: 'New words', context: null, status: BusinessFactStatus.Draft, note: 'The answer behind this fact changed, so it needs confirming again.', changedBy: null, changedByName: 'Asha Rao', changedAtUtc: '2026-10-17T09:00:00Z' },
          { number: 1, kind: BusinessFactChangeKind.Created, category: 'Services', subject: null, statement: 'Old words', context: null, status: BusinessFactStatus.Draft, note: null, changedBy: null, changedByName: null, changedAtUtc: '2026-10-10T09:00:00Z' },
        ])
      );

      open(el);

      expect(studio.getFactHistory).toHaveBeenCalledWith('a');
      const rows = Array.from(el.querySelectorAll('[data-testid="fact-history"] li')).map((li) => text(li));
      expect(rows.length).toBe(2);
      expect(rows[0]).toContain('Needs checking again');
      expect(rows[0]).toContain('Asha Rao');
      expect(rows[0]).toContain('needs confirming again');
      expect(rows[1]).toContain('Added');
      expect(rows[1]).toContain('The system');
    });

    it('adds proof and an end date to a questionnaire fact without touching its wording, and keeps it verified', () => {
      const el = render([verified('q', { sourceType: BusinessFactSource.Questionnaire, sourceRef: 'price_info' })]);
      studio.updateFactDetails.and.returnValue(of(verified('q', { evidence: 'Price list 2026', expiresAtUtc: '2027-03-31T23:59:59Z' })));
      open(el);
      const component = fixture.componentInstance;

      expect(component.editable).toBeFalse();
      expect(component.detailsEditable).toBeTrue();
      expect(component.dirty).toBeFalse();

      component.evidence.setValue('Price list 2026');
      component.validUntil.setValue('2027-03-31');
      expect(component.dirty).toBeTrue();
      component.save();

      expect(studio.updateFact).not.toHaveBeenCalled();
      expect(studio.updateFactDetails).toHaveBeenCalledWith('q', { evidence: 'Price list 2026', expiresAtUtc: '2027-03-31T23:59:59Z' });
      expect(notify.success).toHaveBeenCalledWith('Saved. The fact stays verified.');
    });

    it('shows a fact\'s proof and end date for editing, and clears them when emptied', () => {
      const el = render([fact('a', { evidence: 'Signed form', expiresAtUtc: '2026-12-31T23:59:59Z' })]);
      studio.updateFact.and.returnValue(of(fact('a')));

      open(el);
      const component = fixture.componentInstance;
      expect(component.evidence.value).toBe('Signed form');
      expect(component.validUntil.value).toBe('2026-12-31');

      component.evidence.setValue('');
      component.validUntil.setValue('');
      component.save();

      expect(studio.updateFact).toHaveBeenCalledWith('a', jasmine.objectContaining({ evidence: null, expiresAtUtc: null }));
    });

    it('gives a retired fact no way to be changed', () => {
      const el = render([fact('a', { status: BusinessFactStatus.Retired, classification: KnowledgeClassification.Retired })]);

      open(el);

      expect(fixture.componentInstance.detailsEditable).toBeFalse();
      expect(fixture.componentInstance.editable).toBeFalse();
    });
  });
});

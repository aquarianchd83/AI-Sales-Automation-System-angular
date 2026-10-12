import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { BusinessFact, BusinessFactSource, BusinessFactStatus } from '../../../core/models/content-studio.model';
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
  ...over,
});

describe('StudioFactsComponent', () => {
  let fixture: ComponentFixture<StudioFactsComponent>;
  let studio: jasmine.SpyObj<ContentStudioService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(rows: BusinessFact[], role: AppRole = AppRole.Admin): HTMLElement {
    studio = jasmine.createSpyObj('ContentStudioService', ['getFacts', 'getFactSummary', 'createFact', 'updateFact', 'verifyFact', 'retireFact']);
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

    expect(studio.updateFact).toHaveBeenCalledWith('a', { category: 'Services', statement: 'Changed' });
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

    expect(studio.createFact).toHaveBeenCalledWith({ category: 'Contact', statement: 'We are in Delhi.' });
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
});

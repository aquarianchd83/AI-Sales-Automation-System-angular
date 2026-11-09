import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { SceneVideoProviderKind, StoryKnowledge, StoryVariation, StoryVideoRequest } from '../../../core/models/story-studio.model';
import { TenantProfile } from '../../../core/models/tenant-profile.model';
import { NotificationService } from '../../../core/services/notification.service';
import { StoryStudioService } from '../../../core/services/story-studio.service';
import { TenantProfileService } from '../../../core/services/tenant-profile.service';
import { SharedModule } from '../../../shared/shared.module';
import { StudioStoryNewComponent } from './studio-story-new.component';

const PROBLEMS =
  'Problems our product solves: 1) AI Lead Discovery: Find potential customers.; 2) AI Lead Qualification: Classify leads as hot, warm and cold.; 3) AI Sales Agent: Answer customer questions.';

const knowledge = (over: Partial<StoryKnowledge> = {}): StoryKnowledge => ({
  isReady: true,
  verifiedFacts: 4,
  message: null,
  facts: [
    { id: 'a', category: 'About', subject: null, statement: 'The business is called Bansal Corp.' },
    { id: 'c', category: 'Customers', subject: null, statement: 'Our customers are Businesses.' },
    { id: 'o', category: 'Offers', subject: null, statement: 'Current offer: 10% discount' },
    { id: 'p', category: 'Problems', subject: null, statement: PROBLEMS },
  ],
  ...over,
});

const profile = (over: Partial<TenantProfile> = {}): TenantProfile => ({
  companyName: 'Bansal Corp',
  productName: 'Sellio',
  industry: 'Real estate',
  industrySubcategory: 'Brokerage',
  businessDescription: 'We sell.',
  websiteUrl: null,
  supportEmail: null,
  supportPhone: null,
  domainKeywords: ['crm'],
  timezone: 'Asia/Kolkata',
  countryCode: 'IN',
  workingHours: 'Mon-Fri',
  targetAudience: 'Small business owners',
  targetLocation: null,
  targetCustomerType: null,
  ...over,
});

const variation = (n: number): StoryVariation => ({ angle: `Angle ${n}`, title: `Title ${n}`, hook: `Hook ${n}.`, outline: `Outline ${n}.` });

describe('StudioStoryNewComponent', () => {
  let fixture: ComponentFixture<StudioStoryNewComponent>;
  let comp: StudioStoryNewComponent;
  let api: jasmine.SpyObj<StoryStudioService>;
  let profiles: jasmine.SpyObj<TenantProfileService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let navigate: jasmine.Spy;

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (selector: string) => root().querySelector(selector) as HTMLElement | null;
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (selector: string) => {
    (q(selector) as HTMLElement).click();
    fixture.detectChanges();
  };

  function render(k: StoryKnowledge = knowledge(), p: TenantProfile | null = profile()): void {
    api = jasmine.createSpyObj('StoryStudioService', ['getKnowledge', 'suggestVariations', 'raiseRequest']);
    profiles = jasmine.createSpyObj('TenantProfileService', ['getProfile', 'updateBusinessProfile']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    api.getKnowledge.and.returnValue(of(k));
    profiles.getProfile.and.returnValue(p ? of(p) : throwError(() => new Error('no profile')));
    api.suggestVariations.and.returnValue(of([1, 2, 3, 4, 5, 6].map(variation)));
    api.raiseRequest.and.callFake((body) => of({ id: 'r-' + body.title, projectId: 'p-' + body.title, title: body.title, status: 'Raised' } as unknown as StoryVideoRequest));

    TestBed.configureTestingModule({
      declarations: [StudioStoryNewComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: StoryStudioService, useValue: api },
        { provide: TenantProfileService, useValue: profiles },
        { provide: NotificationService, useValue: notify },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(StudioStoryNewComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('has a way back to the stories, and the progress bar stops once the facts and profile are read', () => {
    render();

    expect(q('[data-testid="back-to-stories"]')?.getAttribute('href')).toBe('/content-studio/stories');
    expect(comp.loading).toBeFalse();
    expect(q('mat-progress-bar[mode="indeterminate"]')).toBeNull();
  });

  it('stops with a plain message and links to the questionnaire when there are no verified facts', () => {
    render(knowledge({ isReady: false, verifiedFacts: 0, facts: [], message: 'You have no verified business facts yet.' }));

    expect(text(q('[data-testid="no-facts"]'))).toContain('no verified business facts');
    expect(Array.from(root().querySelectorAll('[data-testid="no-facts"] a')).map((a) => a.getAttribute('href'))).toEqual([
      '/content-studio/questionnaire', '/content-studio/facts',
    ]);
    expect(q('[data-testid="step-problem"]')).toBeNull();
  });

  it('lists only the problems, and prefills the answers from what the tenant already gave', () => {
    render();

    expect(root().textContent).not.toContain('Bansal Corp');
    expect(comp.problems.map((p) => p.title)).toEqual(['AI Lead Discovery', 'AI Lead Qualification', 'AI Sales Agent']);
    expect((q('[data-testid="problem-summary"]') as HTMLTextAreaElement).value).toBe('Find potential customers.');
    expect(comp.businessProblem).toBe('Find potential customers.');
    expect(comp.solutionChoice).toBe('AI Lead Discovery');
    expect(comp.solutionOptions).toEqual(['AI Lead Discovery', 'AI Lead Qualification', 'AI Sales Agent']);
    expect(comp.audienceOptions).toEqual(['Small business owners', 'Our customers are Businesses.']);
    expect(text(q('[data-testid="sector-badge"]'))).toBe('From your business profile: Real estate');
  });

  it('changing the problem restarts the answers from that problem and drops the old variations', () => {
    render();
    comp.sectorAcceptedAsIs = true;
    comp.generate();
    expect(comp.variations.length).toBe(6);

    comp.pickProblem(1);
    fixture.detectChanges();

    expect(comp.businessProblem).toBe('Classify leads as hot, warm and cold.');
    expect(comp.solutionChoice).toBe('AI Lead Qualification');
    expect(comp.variations).toEqual([]);
  });

  describe('the sector', () => {
    it('must be confirmed before variations are written', () => {
      render();

      click('[data-testid="generate"]');
      expect(api.suggestVariations).not.toHaveBeenCalled();
      expect(q('[data-testid="sector-error"]')).not.toBeNull();

      click('[data-testid="sector-accept"]');
      expect(q('[data-testid="sector-error"]')).toBeNull();
      expect(text(q('[data-testid="sector-message"]'))).toContain('Your profile is unchanged');

      click('[data-testid="generate"]');
      expect(api.suggestVariations).toHaveBeenCalledTimes(1);
    });

    it('confirming the profile sector never touches the profile', () => {
      render();
      click('[data-testid="sector-accept"]');

      expect(profiles.updateBusinessProfile).not.toHaveBeenCalled();
    });

    it('a different sector asks whether to update the profile, and "only this story" leaves the profile alone', () => {
      render();
      comp.sectorChoice = 'Healthcare';
      comp.sectorChanged();
      fixture.detectChanges();

      expect(text(q('[data-testid="sector-ask"]'))).toContain('Your business profile says Real estate');
      expect(text(q('[data-testid="sector-badge"]'))).toBe('Different from your profile');
      expect(comp.sectorConfirmed).toBeFalse();

      click('[data-testid="sector-story-only"]');

      expect(profiles.updateBusinessProfile).not.toHaveBeenCalled();
      expect(comp.sectorConfirmed).toBeTrue();
      expect(text(q('[data-testid="sector-badge"]'))).toBe('This story only');
      expect(text(q('[data-testid="sector-message"]'))).toContain('still says Real estate');
    });

    it('"update my profile" writes the new sector, keeps every other field, and drops the old speciality', () => {
      render();
      profiles.updateBusinessProfile.and.returnValue(of(profile({ industry: 'Healthcare', industrySubcategory: null })));
      comp.sectorChoice = 'Healthcare';
      comp.sectorChanged();
      fixture.detectChanges();

      click('[data-testid="sector-update-profile"]');

      const body = profiles.updateBusinessProfile.calls.mostRecent().args[0];
      expect(body).toEqual(jasmine.objectContaining({
        industry: 'Healthcare', industrySubcategory: null, companyName: 'Bansal Corp', productName: 'Sellio', domainKeywords: ['crm'],
        workingHours: 'Mon-Fri', targetAudience: 'Small business owners',
      }));
      expect(comp.sectorConfirmed).toBeTrue();
      expect(text(q('[data-testid="sector-badge"]'))).toBe('Updated in your business profile');
    });

    it('stays unconfirmed and says so when the profile could not be saved', () => {
      render();
      profiles.updateBusinessProfile.and.returnValue(throwError(() => new Error('nope')));
      comp.sectorChoice = 'Healthcare';
      comp.sectorChanged();
      fixture.detectChanges();

      click('[data-testid="sector-update-profile"]');

      expect(comp.sectorConfirmed).toBeFalse();
      expect(notify.error).toHaveBeenCalled();
    });

    it('takes a typed sector with "Other", and changing it again asks again', () => {
      render();
      comp.sectorChoice = '__other__';
      comp.sectorOther = 'Pet care';
      comp.sectorChanged();
      fixture.detectChanges();
      click('[data-testid="sector-story-only"]');
      expect(comp.sector).toBe('Pet care');
      expect(comp.sectorConfirmed).toBeTrue();

      comp.sectorOther = 'Pet grooming';
      comp.sectorChanged();
      expect(comp.sectorConfirmed).toBeFalse();
    });

    it('with no sector in the profile, any choice is offered to be saved to it', () => {
      render(knowledge(), profile({ industry: null }));
      comp.sectorChoice = 'Healthcare';
      comp.sectorChanged();
      fixture.detectChanges();

      expect(text(q('[data-testid="sector-ask"]'))).toContain('has no sector yet');
    });
  });

  describe('variations and scripts', () => {
    function readyToGenerate(): void {
      render();
      click('[data-testid="sector-accept"]');
      comp.audienceChoice = 'Small business owners';
      comp.ctaChoice = 'Book a free demo';
      comp.capabilities = 'Finds leads';
      fixture.detectChanges();
    }

    it('sends the whole brief to the variation writer and shows six to choose from', () => {
      readyToGenerate();
      click('[data-testid="generate"]');

      expect(api.suggestVariations).toHaveBeenCalledWith(jasmine.objectContaining({
        problem: 'Find potential customers.', sector: 'Real estate', audience: 'Small business owners', solution: 'AI Lead Discovery',
        capabilities: 'Finds leads', callToAction: 'Book a free demo', language: 'Hinglish', targetSeconds: 30,
      }));
      expect(root().querySelectorAll('[data-variation]').length).toBe(6);
    });

    it('counts the sector and the seven answers as the page is filled in', () => {
      render();
      expect(comp.filled).toBe(2); // the problem and the solution are prefilled; the sector is not confirmed yet
      click('[data-testid="sector-accept"]');
      expect(comp.filled).toBe(3);
      expect(text(q('[data-testid="filled-count"]'))).toBe('3 of 8 filled');
    });

    it('offers calls to action as a dropdown: the ones the business wrote first, then common ones, then Other', () => {
      render(knowledge({ facts: [...knowledge().facts, { id: 'x', category: 'Call to action', subject: null, statement: 'Message us on WhatsApp' }] }));

      expect(comp.ctaOptions[0]).toBe('Message us on WhatsApp');
      expect(comp.ctaOptions).toContain('Book a free demo');
      expect(comp.ctaChoice).toBe('Message us on WhatsApp');
      expect(comp.callToAction).toBe('Message us on WhatsApp');

      comp.ctaChoice = '__other__';
      comp.ctaOther = ' Join our webinar ';
      expect(comp.callToAction).toBe('Join our webinar');
    });

    it('has "Raise the request" at the bottom of the page, after the variations', () => {
      render();

      const bar = q('[data-testid="raise-bar"]') as HTMLElement;
      expect(bar).not.toBeNull();
      expect(text(q('[data-testid="raise-request"]'))).toContain('Raise the request');
      const variations = q('[data-testid="step-variations"]') as HTMLElement;
      expect(variations.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(q('[data-testid="write-scripts"]')).toBeNull();
    });

    it('raises one request per ticked variation, with the whole brief, then goes back to the list', () => {
      readyToGenerate();
      comp.targetSeconds = 20;
      comp.language = 'Hindi';
      click('[data-testid="generate"]');
      click('[data-variation="0"]');
      click('[data-variation="3"]');
      expect(text(q('[data-testid="picked-count"]'))).toBe('2 selected');

      click('[data-testid="raise-request"]');

      expect(api.raiseRequest).toHaveBeenCalledTimes(2);
      const first = api.raiseRequest.calls.argsFor(0)[0];
      expect(first.title).toBe('Title 1');
      expect(first.audience).toBe('Small business owners');
      expect(first.moral).toBe('Book a free demo');
      expect(first.targetSeconds).toBe(20);
      expect(first.language).toBe('Hindi');
      expect(first.videoProvider).toBe(SceneVideoProviderKind.Simulator);
      expect(first.characterIds).toEqual([]);
      expect(first.topic).toContain('Sector: Real estate');
      expect(first.topic).toContain('Angle: Angle 1. Opening line: Hook 1.');
      expect(first.topic).toContain('Business facts to follow as instructions');
      expect(first.topic).toContain('Offers: Current offer: 10% discount');
      expect(first.topic).not.toContain('Problems: Problems our product solves');
      expect(api.raiseRequest.calls.argsFor(1)[0].title).toBe('Title 4');
      expect(notify.success).toHaveBeenCalledWith(jasmine.stringContaining('2 requests raised.'));
      expect(navigate).toHaveBeenCalledWith(['/content-studio/stories']);
    });

    it('asks for at least one tick and raises nothing without it', () => {
      readyToGenerate();
      click('[data-testid="generate"]');
      click('[data-testid="raise-request"]');

      expect(q('[data-testid="pick-error"]')).not.toBeNull();
      expect(api.raiseRequest).not.toHaveBeenCalled();
    });

    it('asks for the variations first when none were generated', () => {
      readyToGenerate();
      click('[data-testid="raise-request"]');

      expect(q('[data-testid="pick-error"]')).not.toBeNull();
      expect(api.raiseRequest).not.toHaveBeenCalled();
    });

    it('says how many could not be raised, and still goes back when some were', () => {
      readyToGenerate();
      api.raiseRequest.and.callFake((body) =>
        body.title === 'Title 2' ? throwError(() => new Error('down')) : of({ id: 'r', projectId: 'p', title: body.title, status: 'Raised' } as unknown as StoryVideoRequest));
      click('[data-testid="generate"]');
      click('[data-variation="0"]');
      click('[data-variation="1"]');

      click('[data-testid="raise-request"]');

      expect(notify.success).toHaveBeenCalledWith(jasmine.stringContaining('1 request raised, 1 could not be.'));
      expect(navigate).toHaveBeenCalledWith(['/content-studio/stories']);
    });

    it('stays on the page when no request could be raised', () => {
      readyToGenerate();
      api.raiseRequest.and.returnValue(throwError(() => new Error('down')));
      click('[data-testid="generate"]');
      click('[data-variation="0"]');

      click('[data-testid="raise-request"]');

      expect(notify.error).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});

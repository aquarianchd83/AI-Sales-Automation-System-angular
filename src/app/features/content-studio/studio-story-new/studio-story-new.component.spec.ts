import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { SceneVideoProviderKind, StoryKnowledge, StoryProject, StoryVideoRequest } from '../../../core/models/story-studio.model';
import { TenantProfile } from '../../../core/models/tenant-profile.model';
import { EntitlementsStore } from '../../../core/services/entitlements.store';
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

  function render(k: StoryKnowledge = knowledge(), p: TenantProfile | null = profile(), clone: { id: string; source: StoryProject | 'fails' } | null = null): void {
    api = jasmine.createSpyObj('StoryStudioService', ['getKnowledge', 'raiseRequest', 'getProject']);
    profiles = jasmine.createSpyObj('TenantProfileService', ['getProfile', 'updateBusinessProfile']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    api.getKnowledge.and.returnValue(of(k));
    profiles.getProfile.and.returnValue(p ? of(p) : throwError(() => new Error('no profile')));
    api.getProject.and.returnValue(clone?.source === 'fails' || !clone ? throwError(() => new Error('gone')) : of(clone.source));
    api.raiseRequest.and.callFake((body) => of({ id: 'r-' + body.title, projectId: 'p-' + body.title, title: body.title, status: 'Raised' } as unknown as StoryVideoRequest));

    TestBed.configureTestingModule({
      declarations: [StudioStoryNewComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: StoryStudioService, useValue: api },
        { provide: TenantProfileService, useValue: profiles },
        { provide: NotificationService, useValue: notify },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(clone ? { clone: clone.id } : {}) } } },
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

  it('changing the problem restarts the answers from that problem', () => {
    render();

    comp.pickProblem(1);
    fixture.detectChanges();

    expect(comp.businessProblem).toBe('Classify leads as hot, warm and cold.');
    expect(comp.solutionChoice).toBe('AI Lead Qualification');
  });

  describe('the sector', () => {
    it('must be confirmed before the request is raised', () => {
      render();

      click('[data-testid="raise-request"]');
      expect(api.raiseRequest).not.toHaveBeenCalled();
      expect(q('[data-testid="sector-error"]')).not.toBeNull();

      click('[data-testid="sector-accept"]');
      expect(text(q('[data-testid="sector-message"]'))).toContain('Your profile is unchanged');

      click('[data-testid="raise-request"]');
      expect(q('[data-testid="sector-error"]')).toBeNull();
      expect(api.raiseRequest).toHaveBeenCalledTimes(1);
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

  describe('cloning a story', () => {
    const source = (over: Partial<StoryProject> = {}): StoryProject =>
      ({
        id: 'p1', title: 'AI Sales Agent', language: 'Hindi', targetSeconds: 20, audience: 'Small business owners', moral: 'Contact us today',
        topic: 'Sector: Healthcare\nProblem: Patients wait too long\nTarget audience: Clinic owners\nSolution: AI Sales Agent\nKey capabilities: Answers questions\nBusiness benefits: Fewer missed calls\nDifferentiator: Knows your business\nCall to action: Contact us today\nVideo flow: Problem, Solution, How it works, Business benefit, Call to action.\n\nBusiness facts to follow as instructions:\n- Offers: 10% discount',
        ...over,
      }) as StoryProject;

    it('opens with the same answers, and says it is a copy', () => {
      render(knowledge(), profile(), { id: 'p1', source: source() });

      expect(api.getProject).toHaveBeenCalledWith('p1');
      expect(text(q('[data-testid="clone-note"]'))).toContain('Copied from "AI Sales Agent"');
      expect(comp.selectedProblem?.title).toBe('AI Sales Agent');
      expect(comp.businessProblem).toBe('Patients wait too long');
      expect(comp.solutionChoice).toBe('AI Sales Agent');
      expect(comp.capabilities).toBe('Answers questions');
      expect(comp.benefits).toBe('Fewer missed calls');
      expect(comp.differentiator).toBe('Knows your business');
      expect(comp.ctaChoice).toBe('Contact us today');
      expect(comp.language).toBe('Hindi');
      expect(comp.targetSeconds).toBe(20);
    });

    it('selects an audience that is on the list, and types in one that is not', () => {
      render(knowledge(), profile(), { id: 'p1', source: source({ topic: 'Target audience: Small business owners\nProblem: x' }) });
      expect(comp.audienceChoice).toBe('Small business owners');
      expect(comp.audienceOther).toBe('');

      TestBed.resetTestingModule();
      render(knowledge(), profile(), { id: 'p1', source: source() });
      expect(comp.audienceChoice).toBe('__other__');
      expect(comp.audienceOther).toBe('Clinic owners');
    });

    it('still asks for the sector to be confirmed, and treats a different one like any other change', () => {
      render(knowledge(), profile(), { id: 'p1', source: source() });
      fixture.detectChanges();

      expect(comp.sector).toBe('Healthcare');
      expect(comp.sectorConfirmed).toBeFalse();
      expect(q('[data-testid="sector-ask"]')).not.toBeNull();
    });

    it('is raised as a new request: nothing is raised until the button is clicked, and it carries the copied answers', () => {
      render(knowledge(), profile(), { id: 'p1', source: source({ topic: source().topic.replace('Healthcare', 'Real estate') }) });
      expect(api.raiseRequest).not.toHaveBeenCalled();

      click('[data-testid="sector-accept"]');
      click('[data-testid="raise-request"]');

      const body = api.raiseRequest.calls.mostRecent().args[0];
      expect(body.title).toBe('AI Sales Agent');
      expect(body.topic).toContain('Problem: Patients wait too long');
      expect(body.topic).toContain('Key capabilities: Answers questions');
      expect(body.moral).toBe('Contact us today');
      expect(body.language).toBe('Hindi');
      expect(body.targetSeconds).toBe(20);
    });

    it('opens as an ordinary New story when the story to copy cannot be read', () => {
      render(knowledge(), profile(), { id: 'gone', source: 'fails' });

      expect(q('[data-testid="clone-note"]')).toBeNull();
      expect(comp.selectedProblemIndex).toBe(0);
      expect(comp.loading).toBeFalse();
    });

    it('is not a copy when opened without one', () => {
      render();

      expect(api.getProject).not.toHaveBeenCalled();
      expect(q('[data-testid="clone-note"]')).toBeNull();
    });
  });

  describe('raising the request', () => {
    function readyToRaise(): void {
      render();
      click('[data-testid="sector-accept"]');
      comp.audienceChoice = 'Small business owners';
      comp.ctaChoice = 'Book a free demo';
      comp.capabilities = 'Finds leads';
      fixture.detectChanges();
    }

    it('has no variations section: the page ends with the request', () => {
      render();

      expect(q('[data-testid="step-variations"]')).toBeNull();
      expect(q('[data-testid="generate"]')).toBeNull();
      expect(root().textContent).not.toContain('Variations of this problem');
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

    it('shows what preparing the video costs at the top of the page and beside "Raise the request"', () => {
      render();

      expect(q('[data-testid="cost-top"] app-credit-cost')).not.toBeNull();
      expect(text(q('[data-testid="cost-top"]'))).toContain('This video costs');
      const bar = q('[data-testid="raise-bar"]') as HTMLElement;
      expect(bar.querySelector('[data-testid="raise-cost"]')).not.toBeNull();
      expect(text(bar.querySelector('[data-testid="raise-cost"]'))).toContain('This video costs');
      expect(text(bar.querySelector('[data-testid="raise-request"]'))).toContain('Raise the request');
    });

    it('promises the tenant a refund if the video is not created, at the top and by the button', () => {
      render();

      expect(text(q('[data-testid="cost-top"]'))).toContain('refunded in full');
      const promise = q('[data-testid="raise-bar"] [data-testid="refund-promise"]') as HTMLElement;
      expect(promise).not.toBeNull();
      expect(text(promise)).toContain('If the video is not created, the credits you prepay are refunded in full.');
    });

    it('states the video render price the platform set (not the per-step generation price), in both places', () => {
      render();
      TestBed.inject(EntitlementsStore).set({
        planCode: 'pro', planName: 'Pro', features: ['ContentStudio'], balance: 48,
        costs: [
          { feature: 'ContentStudio', scenario: 3, title: 'Studio generation', unitLabel: 'step', credits: 1, perAction: true },
          { feature: 'ContentStudio', scenario: 4, title: 'Studio video render', unitLabel: 'video', credits: 1500, perAction: true },
        ],
      } as any);
      fixture.detectChanges();

      expect(text(q('[data-testid="cost-top"] [data-testid="credit-cost"]'))).toContain('This video costs 1,500 credits per video');
      expect(text(q('[data-testid="raise-bar"] [data-testid="credit-cost"]'))).toContain('This video costs 1,500 credits per video');
    });

    it('raises one request with the whole brief and goes back to the list', () => {
      readyToRaise();
      comp.targetSeconds = 20;
      comp.language = 'Hindi';

      click('[data-testid="raise-request"]');

      expect(api.raiseRequest).toHaveBeenCalledTimes(1);
      const body = api.raiseRequest.calls.mostRecent().args[0];
      expect(body.title).toBe('AI Lead Discovery');
      expect(body.audience).toBe('Small business owners');
      expect(body.moral).toBe('Book a free demo');
      expect(body.targetSeconds).toBe(20);
      expect(body.language).toBe('Hindi');
      expect(body.videoProvider).toBe(SceneVideoProviderKind.Simulator);
      expect(body.characterIds).toEqual([]);
      expect(body.topic).toContain('Sector: Real estate');
      expect(body.topic).toContain('Problem: Find potential customers.');
      expect(body.topic).toContain('Solution: AI Lead Discovery');
      expect(body.topic).toContain('Key capabilities: Finds leads');
      expect(body.topic).toContain('Business facts to follow as instructions');
      expect(body.topic).toContain('Offers: Current offer: 10% discount');
      expect(body.topic).not.toContain('Problems: Problems our product solves');
      expect(notify.success).toHaveBeenCalledWith(jasmine.stringContaining('Request raised.'));
      expect(navigate).toHaveBeenCalledWith(['/content-studio/stories']);
    });

    it('asks to describe the problem when it is empty, and raises nothing', () => {
      readyToRaise();
      comp.businessProblem = '  ';
      comp.problems = [];
      fixture.detectChanges();

      comp.raise();
      fixture.detectChanges();

      expect(comp.problemError).toBeTrue();
      expect(api.raiseRequest).not.toHaveBeenCalled();
    });

    it('stays on the page when the request could not be raised (the error interceptor shows why, for example not enough credits)', () => {
      readyToRaise();
      api.raiseRequest.and.returnValue(throwError(() => new Error('down')));

      click('[data-testid="raise-request"]');

      expect(navigate).not.toHaveBeenCalled();
      expect(notify.success).not.toHaveBeenCalled();
      expect(comp.raising).toBeFalse();
    });
  });
});

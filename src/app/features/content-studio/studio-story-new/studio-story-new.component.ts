import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';

import { CreateStoryProjectBody, SceneVideoProviderKind, StoryKnowledge, StoryProject } from '../../../core/models/story-studio.model';
import { INDUSTRY_SUGGESTIONS, TenantProfile, UpdateTenantBusinessProfileRequest } from '../../../core/models/tenant-profile.model';
import { NotificationService } from '../../../core/services/notification.service';
import { StoryStudioService } from '../../../core/services/story-studio.service';
import { TenantProfileService } from '../../../core/services/tenant-profile.service';
import { ProblemOption, StoryBrief, buildStoryTopic, factList, factText, parseProblems, parseStoryTopic } from '../studio-stories/story-brief';

/** The value of a dropdown's "Other (type your own)" entry. */
export const OTHER = '__other__';

/** Calls to action offered after the ones the business wrote down itself. */
export const DEFAULT_CALLS_TO_ACTION = ['Book a free demo', 'Start your free trial', 'Contact us today', 'Get a free quote', 'Visit our website'];

/**
 * New story: pick one of the problems the business solves, confirm the sector it belongs to, answer seven short questions about it, then raise
 * the request. The tenant does not write the script or make the video: the request hands it to the platform team, who tell the tenant in-app when
 * the video is ready. The page shows the price of one video (the platform's "Content Studio video render" credit cost).
 *
 * The sector is the one the tenant already gave in their business profile. It is shown here to be confirmed; only when the tenant picks a
 * different one and says "update my profile" is the profile written. Otherwise the profile is never touched.
 */
@Component({
  selector: 'app-studio-story-new',
  templateUrl: './studio-story-new.component.html',
  styleUrls: ['./studio-story-new.component.scss'],
})
export class StudioStoryNewComponent implements OnInit, OnDestroy {
  readonly OTHER = OTHER;
  readonly languages = ['Hinglish', 'Hindi', 'English'];
  readonly lengths = [20, 30];

  loading = true;
  knowledge: StoryKnowledge | null = null;

  /** The saved draft this page is editing, once there is one: opened from the list, or created by the first "Save draft". */
  draftId: string | null = null;
  savingDraft = false;
  profile: TenantProfile | null = null;

  // 1. the problem
  problems: ProblemOption[] = [];
  selectedProblemIndex = 0;

  // sector
  sectorOptions: string[] = [];
  sectorChoice = '';
  sectorOther = '';
  /** The tenant clicked "Looks right" on the sector their profile already holds. */
  sectorAcceptedAsIs = false;
  /** What the tenant answered when they picked a sector different from the profile's: update the profile, or only this story. */
  sectorDecision: 'none' | 'profile' | 'story' = 'none';
  savingProfile = false;

  // 2. the answers
  audienceOptions: string[] = [];
  audienceChoice = '';
  audienceOther = '';
  solutionOptions: string[] = [];
  solutionChoice = '';
  solutionOther = '';
  businessProblem = '';
  capabilities = '';
  benefits = '';
  differentiator = '';
  ctaOptions: string[] = [];
  ctaChoice = '';
  ctaOther = '';
  targetSeconds = 30;
  language = 'Hinglish';

  /** Set when the page was opened with "Clone" on a story: the title it started from. */
  clonedFrom: string | null = null;

  // the request
  raising = false;
  sectorError = false;
  problemError = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly studio: StoryStudioService,
    private readonly profiles: TenantProfileService,
    private readonly notifications: NotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const draft = this.route.snapshot.queryParamMap?.get('draft') ?? null;
    const cloneId = draft ?? this.route.snapshot.queryParamMap?.get('clone') ?? null;
    forkJoin({
      knowledge: this.studio.getKnowledge().pipe(catchError(() => of(null))),
      profile: this.profiles.getProfile().pipe(catchError(() => of(null))),
      source: cloneId ? this.studio.getProject(cloneId).pipe(catchError(() => of(null))) : of(null),
    })
      .pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe(({ knowledge, profile, source }) => {
        this.knowledge = knowledge;
        this.profile = profile;
        this.setUp();
        if (source) {
          this.applyClone(source);
          if (draft) {
            // Not a copy: this is the saved draft itself, so saving again updates it.
            this.draftId = source.id;
            this.clonedFrom = null;
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- setting up from what the tenant already told us ----------

  private setUp(): void {
    const facts = this.knowledge?.facts ?? [];
    this.problems = parseProblems(facts);

    const industry = (this.profile?.industry ?? '').trim();
    this.sectorOptions = [...INDUSTRY_SUGGESTIONS];
    if (industry && !this.sectorOptions.some((o) => o.toLowerCase() === industry.toLowerCase())) {
      this.sectorOptions.unshift(industry);
    }
    this.sectorChoice = industry ? this.sectorOptions.find((o) => o.toLowerCase() === industry.toLowerCase()) ?? '' : '';

    const audiences = [this.profile?.targetAudience ?? '', ...factList(facts, /^(customers?|audience|target audience)$/i)]
      .map((a) => a.trim())
      .filter(Boolean);
    this.audienceOptions = this.unique(audiences);

    const written = factList(facts, /^(call to action|cta)$/i);
    this.ctaOptions = this.unique([...written, ...DEFAULT_CALLS_TO_ACTION]);
    this.ctaChoice = written[0] ?? '';
    this.capabilities = factText(facts, /^(key )?(capabilit(y|ies)|features?)$/i);
    this.benefits = factText(facts, /^(business )?benefits?$/i);
    this.differentiator = factText(facts, /^(differentiators?|unique selling points?|why us)$/i);
    this.pickProblem(0);
  }

  /**
   * Starts from another story: the same answers, to change and raise as a new request (a new video, so a new price). The sector still has to be
   * confirmed here, like any other.
   */
  private applyClone(source: StoryProject): void {
    const brief = parseStoryTopic(source.topic);
    const index = this.problems.findIndex((p) => p.title.toLowerCase() === source.title.toLowerCase());
    if (index >= 0) {
      this.pickProblem(index);
    }
    if (brief.problem) {
      this.businessProblem = brief.problem;
    }
    this.capabilities = brief.capabilities ?? '';
    this.benefits = brief.benefits ?? '';
    this.differentiator = brief.differentiator ?? '';

    [this.audienceChoice, this.audienceOther] = this.choose(brief.audience ?? source.audience ?? '', this.audienceOptions);
    [this.solutionChoice, this.solutionOther] = this.choose(brief.solution ?? '', this.solutionOptions, this.solutionChoice);
    [this.ctaChoice, this.ctaOther] = this.choose(brief.callToAction ?? source.moral ?? '', this.ctaOptions, this.ctaChoice);
    if (brief.sector) {
      [this.sectorChoice, this.sectorOther] = this.choose(brief.sector, this.sectorOptions, this.sectorChoice);
      this.sectorChanged();
    }
    if (this.languages.includes(source.language)) {
      this.language = source.language;
    }
    if (this.lengths.includes(source.targetSeconds)) {
      this.targetSeconds = source.targetSeconds;
    }
    this.clonedFrom = source.title;
  }

  /** A dropdown's value for an answer: the matching option, or "Other" with the answer typed in. An empty answer keeps what was there. */
  private choose(value: string, options: string[], keep = ''): [string, string] {
    const wanted = value.trim();
    if (!wanted) {
      return [keep, ''];
    }
    const match = options.find((o) => o.toLowerCase() === wanted.toLowerCase());
    return match ? [match, ''] : [OTHER, wanted];
  }

  private unique(list: string[]): string[] {
    const seen = new Set<string>();
    return list.filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) {
        return false;
      }
      seen.add(k);
      return true;
    });
  }

  get selectedProblem(): ProblemOption | undefined {
    return this.problems[this.selectedProblemIndex];
  }

  /** The problem changed: its summary and its matching solution become the starting answers. */
  pickProblem(index: number): void {
    this.selectedProblemIndex = index;
    const p = this.problems[index];
    this.businessProblem = p?.summary ?? '';
    this.solutionOptions = this.unique(this.problems.map((x) => x.title));
    this.solutionChoice = p?.title ?? '';
    this.solutionOther = '';
    this.problemError = false;
  }

  // ---------- sector ----------

  get sector(): string {
    return (this.sectorChoice === OTHER ? this.sectorOther : this.sectorChoice).trim();
  }

  private get profileSector(): string {
    return (this.profile?.industry ?? '').trim();
  }

  /** The sector on screen is not the one the profile holds. */
  get sectorDiffers(): boolean {
    return !!this.sector && this.sector.toLowerCase() !== this.profileSector.toLowerCase();
  }

  get sectorConfirmed(): boolean {
    if (!this.sector) {
      return false;
    }
    // A decision stays valid after the profile was updated, when the sector no longer differs from it.
    if (this.sectorDecision !== 'none') {
      return true;
    }
    return !this.sectorDiffers && this.sectorAcceptedAsIs;
  }

  get sectorBadge(): string {
    if (this.sectorDecision === 'profile') {
      return 'Updated in your business profile';
    }
    if (this.sectorDecision === 'story') {
      return 'This story only';
    }
    if (this.sectorDiffers) {
      return 'Different from your profile';
    }
    return this.profileSector ? `From your business profile: ${this.profileSector}` : 'Not in your profile yet';
  }

  get sectorMessage(): string {
    if (this.sectorDecision === 'profile') {
      return `Profile updated to ${this.sector}. This story uses it too.`;
    }
    if (this.sectorDecision === 'story') {
      return `Using ${this.sector} for this story only. Your profile ${this.profileSector ? 'still says ' + this.profileSector : 'is unchanged'}.`;
    }
    if (this.sectorAcceptedAsIs && !this.sectorDiffers) {
      return `Confirmed: ${this.sector}. Your profile is unchanged.`;
    }
    return 'Please confirm. The sector sets the examples, tone and wording. One sector per story: for another sector, start a new story.';
  }

  get sectorQuestion(): string {
    const now = this.profileSector ? `Your business profile says ${this.profileSector}.` : 'Your business profile has no sector yet.';
    return `${now} Save ${this.sector} to it, or use ${this.sector} for this story only?`;
  }

  /** The dropdown or the typed sector changed: whatever was decided before no longer applies. */
  sectorChanged(): void {
    this.sectorAcceptedAsIs = false;
    this.sectorDecision = 'none';
    this.sectorError = false;
  }

  acceptSector(): void {
    if (this.sector && !this.sectorDiffers) {
      this.sectorAcceptedAsIs = true;
      this.sectorError = false;
    }
  }

  useSectorForStoryOnly(): void {
    this.sectorDecision = 'story';
    this.sectorError = false;
  }

  /** The only place the business profile is written: the tenant picked a different sector and said to update it. */
  updateProfileSector(): void {
    if (!this.profile || this.savingProfile || !this.sector) {
      return;
    }
    const p = this.profile;
    const request: UpdateTenantBusinessProfileRequest = {
      companyName: p.companyName,
      productName: p.productName,
      industry: this.sector,
      // The speciality belongs to the old industry ("Eye clinic" under Healthcare), so it goes when the industry changes.
      industrySubcategory: null,
      businessDescription: p.businessDescription,
      websiteUrl: p.websiteUrl,
      supportEmail: p.supportEmail,
      supportPhone: p.supportPhone,
      domainKeywords: p.domainKeywords ?? [],
      workingHours: p.workingHours ?? null,
      targetAudience: p.targetAudience ?? null,
      targetLocation: p.targetLocation ?? null,
      targetCustomerType: p.targetCustomerType ?? null,
    };
    this.savingProfile = true;
    this.profiles
      .updateBusinessProfile(request)
      .pipe(finalize(() => (this.savingProfile = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.profile = updated;
          this.sectorDecision = 'profile';
          this.sectorError = false;
        },
        error: () => this.notifications.error('Your profile could not be updated. Try again, or use the sector for this story only.'),
      });
  }

  // ---------- the answers ----------

  get audience(): string {
    return (this.audienceChoice === OTHER ? this.audienceOther : this.audienceChoice).trim();
  }

  get callToAction(): string {
    return (this.ctaChoice === OTHER ? this.ctaOther : this.ctaChoice).trim();
  }

  get solution(): string {
    return (this.solutionChoice === OTHER ? this.solutionOther : this.solutionChoice).trim();
  }

  /** How many of the eight things (sector plus the seven answers) are filled in. */
  get filled(): number {
    return [this.sectorConfirmed, this.businessProblem, this.audience, this.solution, this.capabilities, this.benefits, this.differentiator, this.callToAction].filter(
      (v) => (typeof v === 'string' ? v.trim() !== '' : v),
    ).length;
  }

  get filledPercent(): number {
    return Math.round((this.filled / 8) * 100);
  }

  private get brief(): StoryBrief {
    return {
      sector: this.sector,
      problem: this.businessProblem.trim() || this.selectedProblem?.summary || '',
      audience: this.audience,
      solution: this.solution,
      capabilities: this.capabilities.trim(),
      benefits: this.benefits.trim(),
      differentiator: this.differentiator.trim(),
      callToAction: this.callToAction.trim(),
    };
  }

  // ---------- saving and the request ----------

  private storyBody(): CreateStoryProjectBody {
    const b = this.brief;
    return {
      title: this.selectedProblem?.title ?? (b.problem.slice(0, 100) || 'Untitled story'),
      topic: buildStoryTopic(b, this.knowledge?.facts ?? []),
      language: this.language,
      style: null,
      audience: b.audience || null,
      moral: b.callToAction || null,
      targetSeconds: this.targetSeconds,
      videoProvider: SceneVideoProviderKind.Simulator,
      budgetUsd: null,
      characterIds: [],
    };
  }

  /**
   * Saves what is filled in so far as a draft, however little: nothing is charged and nothing is sent to the platform team. The page stays open; the
   * draft is reopened from the stories list, where it can also be deleted. Saving again updates the same draft.
   */
  saveDraft(): void {
    if (this.savingDraft || this.raising) {
      return;
    }
    this.savingDraft = true;
    const body = this.storyBody();
    const save = this.draftId ? this.studio.updateDraft(this.draftId, body) : this.studio.createProject(body);
    save.pipe(finalize(() => (this.savingDraft = false)), takeUntil(this.destroy$)).subscribe({
      next: (project) => {
        this.draftId = project.id;
        // Reloading the page (or coming back to the link) resumes this draft rather than starting a blank story.
        void this.router.navigate([], { queryParams: { draft: project.id, clone: null }, queryParamsHandling: 'merge', replaceUrl: true });
        this.notifications.success('Draft saved. Open it from Story studio to carry on.');
      },
      // The error interceptor already shows the server's message.
      error: () => undefined,
    });
  }

  /** Raises the request for this problem: the platform team writes the script and makes the video; then back to the list. */
  raise(): void {
    if (this.raising) {
      return;
    }
    this.sectorError = !this.sectorConfirmed;
    this.problemError = !this.brief.problem;
    if (this.sectorError || this.problemError) {
      return;
    }
    this.raising = true;
    this.studio
      .raiseRequest(this.storyBody())
      .pipe(finalize(() => (this.raising = false)), takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notifications.success('Request raised. The platform team will write the script and make the video, and you will be told when it is ready.');
          // The request made its own story from this brief, so the draft it came from is done with. A draft that cannot be removed is only left in the list.
          const draftId = this.draftId;
          if (draftId) {
            this.studio.deleteProject(draftId).pipe(catchError(() => of(null))).subscribe();
          }
          void this.router.navigate(['/content-studio/stories']);
        },
        // The error interceptor already shows the server's message (for example, not enough credits): nothing was charged or saved.
        error: () => undefined,
      });
  }
}

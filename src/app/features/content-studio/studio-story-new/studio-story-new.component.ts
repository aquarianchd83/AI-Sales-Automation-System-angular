import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, finalize, map, switchMap, takeUntil, toArray } from 'rxjs/operators';

import {
  SceneVideoProviderKind,
  StoryKnowledge,
  StoryVariation,
  StoryVariationRequest,
} from '../../../core/models/story-studio.model';
import { INDUSTRY_SUGGESTIONS, TenantProfile, UpdateTenantBusinessProfileRequest } from '../../../core/models/tenant-profile.model';
import { NotificationService } from '../../../core/services/notification.service';
import { StoryStudioService } from '../../../core/services/story-studio.service';
import { TenantProfileService } from '../../../core/services/tenant-profile.service';
import { ProblemOption, StoryBrief, buildStoryTopic, factList, factText, parseProblems } from '../studio-stories/story-brief';

/** The value of a dropdown's "Other (type your own)" entry. */
export const OTHER = '__other__';

/** Calls to action offered after the ones the business wrote down itself. */
export const DEFAULT_CALLS_TO_ACTION = ['Book a free demo', 'Start your free trial', 'Contact us today', 'Get a free quote', 'Visit our website'];

/**
 * New story: pick one of the problems the business solves, confirm the sector it belongs to, answer seven short questions about it, then
 * generate five or six variations of that problem and tick the ones to turn into stories - one story, one script, per ticked variation.
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

  // 3. the variations
  variations: StoryVariation[] = [];
  picked = new Set<number>();
  generating = false;
  writing = false;
  sectorError = false;
  problemError = false;
  pickError = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly studio: StoryStudioService,
    private readonly profiles: TenantProfileService,
    private readonly notifications: NotificationService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    forkJoin({
      knowledge: this.studio.getKnowledge().pipe(catchError(() => of(null))),
      profile: this.profiles.getProfile().pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe(({ knowledge, profile }) => {
        this.knowledge = knowledge;
        this.profile = profile;
        this.setUp();
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

  /** The problem changed: its summary and its matching solution become the starting answers, and any variations are stale. */
  pickProblem(index: number): void {
    this.selectedProblemIndex = index;
    const p = this.problems[index];
    this.businessProblem = p?.summary ?? '';
    this.solutionOptions = this.unique(this.problems.map((x) => x.title));
    this.solutionChoice = p?.title ?? '';
    this.solutionOther = '';
    this.variations = [];
    this.picked.clear();
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

  // ---------- variations ----------

  generate(): void {
    if (this.generating || this.writing) {
      return;
    }
    this.sectorError = !this.sectorConfirmed;
    this.problemError = !this.brief.problem;
    if (this.sectorError || this.problemError) {
      return;
    }
    const b = this.brief;
    const body: StoryVariationRequest = {
      problem: b.problem,
      sector: b.sector,
      audience: b.audience || null,
      solution: b.solution || null,
      capabilities: b.capabilities || null,
      benefits: b.benefits || null,
      differentiator: b.differentiator || null,
      callToAction: b.callToAction || null,
      language: this.language,
      targetSeconds: this.targetSeconds,
    };
    this.generating = true;
    this.studio
      .suggestVariations(body)
      .pipe(finalize(() => (this.generating = false)), takeUntil(this.destroy$))
      .subscribe((variations) => {
        this.variations = variations;
        this.picked.clear();
        this.pickError = false;
      });
  }

  toggle(index: number): void {
    if (this.picked.has(index)) {
      this.picked.delete(index);
    } else {
      this.picked.add(index);
    }
    this.pickError = false;
  }

  /** One story, with its own script, per ticked variation; then back to the list. */
  writeScripts(): void {
    if (this.writing || this.generating) {
      return;
    }
    const chosen = this.variations.filter((_, i) => this.picked.has(i));
    if (!chosen.length) {
      this.pickError = true;
      return;
    }
    const facts = this.knowledge?.facts ?? [];
    const b = this.brief;
    this.writing = true;
    from(chosen)
      .pipe(
        concatMap((v) =>
          this.studio
            .createProject({
              title: v.title,
              topic: buildStoryTopic(b, v, facts),
              language: this.language,
              style: null,
              audience: b.audience || null,
              moral: b.callToAction || null,
              targetSeconds: this.targetSeconds,
              videoProvider: SceneVideoProviderKind.Simulator,
              budgetUsd: null,
              characterIds: [],
            })
            .pipe(
              switchMap((project) =>
                this.studio.generateScript(project.id).pipe(
                  map(() => ({ created: true, scripted: true })),
                  catchError(() => of({ created: true, scripted: false })),
                ),
              ),
              catchError(() => of({ created: false, scripted: false })),
            ),
        ),
        toArray(),
        finalize(() => (this.writing = false)),
        takeUntil(this.destroy$),
      )
      .subscribe((results) => {
        const created = results.filter((r) => r.created).length;
        const scripted = results.filter((r) => r.scripted).length;
        if (!created) {
          this.notifications.error('No story could be created. Nothing was saved.');
          return;
        }
        const stories = `${created} ${created === 1 ? 'story' : 'stories'}`;
        if (scripted === created) {
          this.notifications.success(`${stories} created, with a script each.`);
        } else {
          this.notifications.info(`${stories} created, ${scripted} with a script. Open the others to write theirs.`);
        }
        void this.router.navigate(['/content-studio/stories']);
      });
  }

  back(): void {
    void this.router.navigate(['/content-studio/stories']);
  }
}

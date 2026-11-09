import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, forkJoin, interval } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';

import {
  CinematicScript,
  SCENE_VIDEO_PROVIDER_HINTS,
  SCENE_VIDEO_PROVIDER_LABELS,
  STORY_PLATFORM_LABELS,
  STORY_PROJECT_STATUS_LABELS,
  STORY_SCENE_STATUS_LABELS,
  SceneVideoProviderKind,
  ScriptClaim,
  StoryCharacter,
  StoryCheck,
  StoryPlatform,
  StoryPublishPack,
  StoryClipScene,
  StoryCostEstimate,
  StoryIdea,
  StoryKnowledge,
  StoryJobStatus,
  StoryProject,
  StoryProjectStatus,
  StoryRender,
  StorySceneStatus,
  StoryScriptVersion,
  StoryUsage,
  VideoSource,
} from '../../../core/models/story-studio.model';
import { StudioActivityKind } from '../../../core/models/content-studio.model';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { formatUnits } from '../../../core/models/billing.model';
import { NotificationService } from '../../../core/services/notification.service';
import { StoryStudioService } from '../../../core/services/story-studio.service';

/**
 * The cinematic story studio on one page: the project list on the left, and on the right either the brief for a new story
 * (topic, language, cast, video source) or the chosen story's script - written, edited, and approved in place. Nothing paid
 * happens before the script is approved.
 */
@Component({
  selector: 'app-studio-stories',
  templateUrl: './studio-stories.component.html',
  styleUrls: ['./studio-stories.component.scss'],
})
export class StudioStoriesComponent implements OnInit, OnDestroy {
  readonly providerKinds = [SceneVideoProviderKind.Simulator, SceneVideoProviderKind.Veo, SceneVideoProviderKind.FlowImport];
  readonly providerLabels = SCENE_VIDEO_PROVIDER_LABELS;
  readonly providerHints = SCENE_VIDEO_PROVIDER_HINTS;
  readonly statusLabels = STORY_PROJECT_STATUS_LABELS;
  readonly statusEnum = StoryProjectStatus;
  readonly platformLabels = STORY_PLATFORM_LABELS;
  readonly sceneStatus = StorySceneStatus;
  readonly jobStatus = StoryJobStatus;
  readonly sceneStatusLabels = STORY_SCENE_STATUS_LABELS;
  readonly languages = ['Hinglish', 'Hindi', 'English'];

  /** Credits each story's script has used so far (charged less refunded), by project id. Missing until the activity list answers. */
  charges: Record<string, number> = {};

  /** The "Problems" facts split into one entry per problem, for the picker on step 1. */
  problems: ProblemOption[] = [];
  selectedProblemIndex = 0;

  get selectedProblem(): ProblemOption | undefined {
    return this.problems[this.selectedProblemIndex];
  }

  /**
   * The later steps (characters, Veo clips, voice, the finished video, sharing) are built but not switched on: a story stops at the approved script
   * until we decide how to go on. Everything below that is for those steps is behind this flag.
   */
  laterSteps = false;

  knowledge: StoryKnowledge | null = null;
  ideas: StoryIdea[] = [];
  ideaLanguage = 'Hinglish';
  loadingIdeas = false;

  projects: StoryProject[] = [];
  characters: StoryCharacter[] = [];
  selected: StoryProject | null = null;
  creating = false;
  /** True on /content-studio/stories/new: the page that holds the New story fields, with a way back to the list. */
  isNewPage = false;

  script: StoryScriptVersion | null = null;
  draft: CinematicScript | null = null;
  dirty = false;
  estimate: StoryCostEstimate | null = null;
  scenes: StoryClipScene[] = [];
  renders: StoryRender[] = [];
  usage: StoryUsage | null = null;
  checks: StoryCheck[] = [];
  videoSources: VideoSource[] = [];
  pack: StoryPublishPack | null = null;
  confirmVoice = false;
  voiceWarnings: Record<string, string[]> = {};
  publishUrls: Record<number, string> = {};
  confirmPictures = false;
  previewUrl: string | null = null;
  previewSafeUrl: SafeUrl | null = null;
  previewTitle = '';
  confirmCost = false;
  flagging: string | null = null;
  flagReason = '';

  loading = true;
  busy = false;
  showNewCharacter = false;
  uploadRights = false;

  readonly search = new FormControl('', { nonNullable: true });
  readonly selectedCharacterIds = new Set<string>();

  readonly brief = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    topic: ['', [Validators.required, Validators.maxLength(4000)]],
    language: ['Hinglish', Validators.required],
    style: [''],
    audience: [''],
    moral: [''],
    targetSeconds: [30, [Validators.required, Validators.min(8), Validators.max(40)]],
    videoProvider: [SceneVideoProviderKind.Simulator],
  });

  readonly character = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    personality: [''],
    visualAttributes: [''],
    voicePreferences: [''],
  });

  private readonly destroy$ = new Subject<void>();
  private readonly stopPolling$ = new Subject<void>();

  constructor(
    private readonly studio: StoryStudioService,
    private readonly metering: ContentStudioService,
    private readonly notifications: NotificationService,
    private readonly fb: FormBuilder,
    private readonly sanitizer: DomSanitizer,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.isNewPage = !!this.route.snapshot.data?.['newStory'];
    this.creating = this.isNewPage && !this.laterSteps;
    if (this.isNewPage) {
      // Only the facts are needed here; the list of stories belongs to the page this one came from.
      // `loading` starts true and only the list load clears it, which this page skips: without this the bar never stops.
      this.loading = false;
      this.loadKnowledge();
      return;
    }
    this.loadAll();
    this.loadKnowledge();
    if (this.laterSteps) {
      this.loadChecks();
    }
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => this.loadCharacters());
  }

  ngOnDestroy(): void {
    this.stopPolling$.next();
    this.clearPreview();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isDraft(): boolean {
    return this.selected?.status === StoryProjectStatus.Draft;
  }

  get castNames(): string[] {
    const ids = this.selected?.characterIds ?? [];
    return this.characters.filter((c) => ids.includes(c.id)).map((c) => c.name);
  }

  private loadAll(): void {
    this.loading = true;
    forkJoin({ projects: this.studio.listProjects(), characters: this.studio.listCharacters() })
      .pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe(({ projects, characters }) => {
        this.projects = projects;
        this.characters = characters;
        this.loadCharges(projects);
        // Back from the New story page with the story just made: open it.
        const wanted = this.route.snapshot.queryParamMap.get('project');
        const made = wanted ? projects.find((p) => p.id === wanted) : undefined;
        if (made) {
          this.open(made);
        }
      });
  }

  /** Sums the studio-credit activity that points at each story (its script writes), net of refunds. */
  private loadCharges(projects: StoryProject[]): void {
    if (!projects.length) {
      return;
    }
    this.metering
      .getActivity({ kind: StudioActivityKind.StoryScript, page: 1, pageSize: 100 })
      .pipe(catchError(() => EMPTY), takeUntil(this.destroy$))
      .subscribe((result) => {
        const totals: Record<string, number> = {};
        for (const p of projects) {
          totals[p.id] = 0;
        }
        for (const a of result.items) {
          const id = (a.referenceId ?? '').toLowerCase();
          if (a.referenceType === 'StoryProject' && id in totals) {
            totals[id] += a.netUnits;
          }
        }
        this.charges = totals;
      });
  }

  /** "2 credits", or "0" for a story that has used none. */
  chargeLabel(id: string): string {
    const v = this.charges[id];
    return v === undefined ? '' : v === 0 ? '0' : `${formatUnits(v)} ${v === 1 ? 'credit' : 'credits'}`;
  }

  private loadCharacters(): void {
    this.studio.listCharacters(this.search.value).pipe(takeUntil(this.destroy$)).subscribe((c) => (this.characters = c));
  }

  private loadKnowledge(): void {
    this.studio.getKnowledge().pipe(takeUntil(this.destroy$)).subscribe((k) => {
      this.knowledge = k;
      this.problems = parseProblems(k.facts ?? []);
      this.selectedProblemIndex = 0;
    });
  }

  /** Step 1: ideas drawn from the verified facts. Test data when the Story script runs on the simulator. */
  suggestIdeas(): void {
    if (this.busy || this.loadingIdeas || !this.knowledge?.isReady) {
      return;
    }
    this.loadingIdeas = true;
    this.studio
      .suggestIdeas(this.ideaLanguage)
      .pipe(finalize(() => (this.loadingIdeas = false)), takeUntil(this.destroy$))
      .subscribe((ideas) => (this.ideas = ideas));
  }

  /** Starts a story from an idea: its problem and how the business solves it become the topic. No cast, no paid source: just the script next. */
  useIdea(idea: StoryIdea): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .createProject({
        title: idea.title,
        topic: buildTopic(idea, this.knowledge?.facts ?? []),
        language: this.ideaLanguage,
        style: null,
        audience: null,
        moral: null,
        targetSeconds: 30,
        videoProvider: SceneVideoProviderKind.Simulator,
        budgetUsd: null,
        characterIds: [],
      })
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((project) => {
        this.ideas = [];
        if (this.isNewPage) {
          // Back to the stories page, with the new story open.
          void this.router.navigate(['/content-studio/stories'], { queryParams: { project: project.id } });
          return;
        }
        this.projects = [project, ...this.projects];
        this.creating = false;
        this.open(project);
      });
  }

  claimFor(scene: number, index: number): ScriptClaim | undefined {
    return this.script?.claims?.find((c) => c.scene === scene && c.order === index + 1);
  }

  get riskyClaims(): ScriptClaim[] {
    return (this.script?.claims ?? []).filter((c) => c.isRisky);
  }

  startNew(): void {
    if (!this.laterSteps) {
      void this.router.navigate(['/content-studio/stories/new']);
      return;
    }
    this.ideas = [];
    this.creating = true;
    this.selected = null;
    this.script = null;
    this.draft = null;
    this.selectedCharacterIds.clear();
  }

  closeNew(): void {
    if (this.isNewPage) {
      void this.router.navigate(['/content-studio/stories']);
      return;
    }
    this.creating = false;
  }

  toggleCharacter(c: StoryCharacter): void {
    if (this.selectedCharacterIds.has(c.id)) {
      this.selectedCharacterIds.delete(c.id);
    } else {
      this.selectedCharacterIds.add(c.id);
    }
  }

  saveCharacter(): void {
    if (this.character.invalid || this.busy) {
      return;
    }
    const v = this.character.getRawValue();
    this.busy = true;
    this.studio
      .createCharacter({
        name: v.name,
        description: v.description || null,
        personality: v.personality || null,
        visualAttributes: v.visualAttributes || null,
        voicePreferences: v.voicePreferences || null,
      })
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((created) => {
        this.characters = [...this.characters, created].sort((a, b) => a.name.localeCompare(b.name));
        this.selectedCharacterIds.add(created.id);
        this.character.reset({ name: '', description: '', personality: '', visualAttributes: '', voicePreferences: '' });
        this.showNewCharacter = false;
        this.notifications.success(`${created.name} added to your characters. Add a picture below so the same face is reused.`);
      });
  }

  /** Uploads a reference picture. The rights box must be ticked; the server checks the file's real type and size. */
  upload(c: StoryCharacter, input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!this.uploadRights) {
      this.notifications.error('Tick the box to confirm you have the rights to use this picture.');
      return;
    }
    this.busy = true;
    this.studio
      .uploadReference(c.id, file, true)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((ref) => {
        this.studio.approveReference(c.id, ref.id).pipe(takeUntil(this.destroy$)).subscribe(() => {
          this.notifications.success(`Picture saved and approved for ${c.name}.`);
          this.loadCharacters();
        });
      });
  }

  createProject(): void {
    if (this.brief.invalid || this.busy) {
      return;
    }
    const v = this.brief.getRawValue();
    this.busy = true;
    this.studio
      .createProject({
        title: v.title,
        topic: v.topic,
        language: v.language,
        style: v.style || null,
        audience: v.audience || null,
        moral: v.moral || null,
        targetSeconds: v.targetSeconds,
        videoProvider: v.videoProvider,
        budgetUsd: null,
        characterIds: [...this.selectedCharacterIds],
      })
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((project) => {
        this.projects = [project, ...this.projects];
        this.creating = false;
        this.brief.reset({ title: '', topic: '', language: 'Hinglish', style: '', audience: '', moral: '', targetSeconds: 30, videoProvider: SceneVideoProviderKind.Simulator });
        this.open(project);
      });
  }

  open(project: StoryProject): void {
    this.creating = false;
    this.selected = project;
    this.script = null;
    this.draft = null;
    this.dirty = false;
    this.estimate = null;
    this.scenes = [];
    this.renders = [];
    this.usage = null;
    this.pack = null;
    this.voiceWarnings = {};
    this.clearPreview();
    this.confirmCost = false;
    this.stopPolling$.next();
    if (project.status !== StoryProjectStatus.Draft && this.laterSteps) {
      this.loadScenes();
    }
    if (project.currentScriptVersionId) {
      this.studio.getScript(project.id).pipe(takeUntil(this.destroy$)).subscribe((s) => this.showScript(s));
    }
    if (this.laterSteps) {
      this.studio.getCostEstimate(project.id).pipe(takeUntil(this.destroy$)).subscribe((e) => (this.estimate = e));
    }
  }

  private showScript(version: StoryScriptVersion): void {
    this.script = version;
    this.draft = JSON.parse(JSON.stringify(version.script)) as CinematicScript;
    this.dirty = false;
  }

  generate(): void {
    if (!this.selected || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .generateScript(this.selected.id)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((version) => {
        this.showScript(version);
        this.selected = { ...this.selected!, currentScriptVersionId: version.id };
        this.notifications.success(version.isSimulated ? 'Test script written. Nothing was charged.' : 'Script written. Read it and edit anything before you approve.');
      });
  }

  markDirty(): void {
    this.dirty = true;
  }

  saveEdits(): void {
    if (!this.selected || !this.draft || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .saveScript(this.selected.id, this.draft)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((version) => {
        this.showScript(version);
        this.notifications.success('Your edits are saved as a new version.');
      });
  }

  changeProvider(kind: SceneVideoProviderKind): void {
    if (!this.selected || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .setVideoProvider(this.selected.id, kind)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((project) => {
        this.replace(project);
        this.studio.getCostEstimate(project.id).pipe(takeUntil(this.destroy$)).subscribe((e) => (this.estimate = e));
      });
  }

  approve(): void {
    if (!this.selected || this.dirty || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .approveScript(this.selected.id)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((scenes) => {
        this.replace({ ...this.selected!, status: StoryProjectStatus.ScriptApproved });
        this.notifications.success(`Script approved: ${scenes.length} scenes are ready for video.`);
        this.loadScenes();
      });
  }

  /** Whether making clips costs money, so the confirm box and the price are shown. */
  get costsMoney(): boolean {
    return !!this.estimate?.isKnown && this.estimate.clipUsd > 0;
  }

  get totalEstimateUsd(): number {
    return this.estimate ? this.estimate.clipUsd * this.scenes.filter((s) => this.canStart(s)).length : 0;
  }

  canStart(s: StoryClipScene): boolean {
    return [StorySceneStatus.Pending, StorySceneStatus.Failed, StorySceneStatus.Flagged].includes(s.status);
  }

  get anyToStart(): boolean {
    return this.scenes.some((s) => this.canStart(s));
  }

  loadScenes(): void {
    if (!this.selected || !this.laterSteps) {
      return;
    }
    const id = this.selected.id;
    this.studio.listScenes(id).pipe(takeUntil(this.destroy$)).subscribe((scenes) => {
      if (this.selected?.id !== id) {
        return;
      }
      this.scenes = scenes;
      this.refreshProjectStatus();
      this.pollWhileWorking();
      this.loadRenders();
      this.loadUsage();
      this.loadPack();
    });
  }

  /** The project status moves as its clips finish (Making clips, In review, Failed), so it is read again from the list. */
  private refreshProjectStatus(): void {
    if (!this.selected) {
      return;
    }
    const id = this.selected.id;
    this.studio.listProjects().pipe(takeUntil(this.destroy$)).subscribe((projects) => {
      this.projects = projects;
      const fresh = projects.find((p) => p.id === id);
      if (fresh && this.selected?.id === id) {
        this.selected = fresh;
      }
    });
  }

  private pollWhileWorking(): void {
    this.stopPolling$.next();
    const clipsWorking = this.scenes.some((s) => s.status === StorySceneStatus.Queued || s.status === StorySceneStatus.Processing);
    const renderWorking = this.renders.some((r) => r.status === StoryJobStatus.Queued || r.status === StoryJobStatus.Processing);
    if (!clipsWorking && !renderWorking) {
      return;
    }
    interval(5000)
      .pipe(takeUntil(this.stopPolling$), takeUntil(this.destroy$))
      .subscribe(() => (clipsWorking ? this.loadScenes() : this.loadRenders()));
  }

  get missingChecks(): StoryCheck[] {
    return this.checks.filter((c) => !c.ok);
  }

  /** Why a clip source cannot be chosen, or null when it can. A source the server did not list is treated as open. */
  sourceReason(kind: SceneVideoProviderKind): string | null {
    const source = this.videoSources.find((s) => s.kind === kind);
    return source && !source.available ? source.reason : null;
  }

  private loadChecks(): void {
    this.studio.getVideoSources().pipe(takeUntil(this.destroy$)).subscribe((s) => (this.videoSources = s));
    this.studio.getDiagnostics().pipe(takeUntil(this.destroy$)).subscribe((c) => (this.checks = c));
  }

  /** Replaces a scene's own audio with generated speech; the original clip is kept. */
  addVoiceOver(s: StoryClipScene): void {
    if (this.busy || (this.costsSpeech && !this.confirmVoice)) {
      return;
    }
    this.busy = true;
    this.studio
      .addVoiceOver(s.id, this.confirmVoice)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((result) => {
        this.confirmVoice = false;
        this.voiceWarnings = { ...this.voiceWarnings, [s.id]: result.warnings };
        this.notifications.success(`Voice-over added to scene ${s.index}.`);
        this.loadScenes();
      });
  }

  /** True when the platform's speech provider is a paid one, so the cost box is shown. */
  get costsSpeech(): boolean {
    return this.checks.some((c) => c.key === 'voice' && !/free test tones/i.test(c.detail));
  }

  private loadPack(): void {
    if (this.selected?.status !== StoryProjectStatus.Approved) {
      return;
    }
    this.studio.getPublishPack(this.selected.id).pipe(takeUntil(this.destroy$)).subscribe((p) => (this.pack = p));
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.notifications.info('Copied.'), () => this.notifications.error('Could not copy. Select the text and copy it by hand.'));
  }

  recordPublication(platform: StoryPlatform): void {
    const url = (this.publishUrls[platform] ?? '').trim();
    if (!this.selected || !url || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .recordPublication(this.selected.id, platform, url)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.publishUrls = { ...this.publishUrls, [platform]: '' };
        this.loadPack();
      });
  }

  get usageSummary(): string {
    return (this.usage?.lines ?? []).map((l) => `${l.category} ${l.actualUsd || l.estimatedUsd ? (l.actualUsd || l.estimatedUsd).toFixed(2) : '0.00'}`).join(', ');
  }

  get canApproveVideo(): boolean {
    return this.selected?.status === StoryProjectStatus.InReview && this.latestRender?.status === StoryJobStatus.Completed;
  }

  approveVideo(): void {
    if (!this.selected || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .approveVideo(this.selected.id)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((project) => {
        this.replace(project);
        this.loadPack();
        this.notifications.success('Video approved. You can download it now.');
      });
  }

  /** Option C: pictures for the characters the script needs and the cast lacks. They wait for approval before they are reused. */
  makeCharacters(): void {
    if (!this.selected || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .generateCharacters(this.selected.id, this.confirmPictures)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((made) => {
        this.confirmPictures = false;
        if (!made.length) {
          this.notifications.info('Your cast already covers every character in the script.');
          return;
        }
        this.notifications.success(`${made.length} new character(s) added with a preview picture.`);
        this.loadCharacters();
        this.open(this.selected!);
      });
  }

  /** Corrects one subtitle. Only the subtitle changes, so the video must be put together again to show it. */
  editLine(s: StoryClipScene, order: number, text: string): void {
    if (!text.trim() || this.busy || s.dialogue[order - 1]?.text === text.trim()) {
      return;
    }
    this.busy = true;
    this.studio
      .editDialogue(s.id, order, text)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.info('Subtitle corrected. Put the video together again to see it.');
        this.loadScenes();
      });
  }

  private loadUsage(): void {
    if (!this.selected) {
      return;
    }
    this.studio.getUsage(this.selected.id).pipe(takeUntil(this.destroy$)).subscribe((u) => (this.usage = u));
  }

  get latestRender(): StoryRender | null {
    return this.renders[0] ?? null;
  }

  private loadRenders(): void {
    if (!this.selected) {
      return;
    }
    const id = this.selected.id;
    this.studio.listRenders(id).pipe(takeUntil(this.destroy$)).subscribe((renders) => {
      if (this.selected?.id !== id) {
        return;
      }
      this.renders = renders;
      this.pollWhileWorking();
    });
  }

  putTogether(): void {
    if (!this.selected || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .startRender(this.selected.id)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((render) => {
        this.renders = [render, ...this.renders];
        this.pollWhileWorking();
      });
  }

  /** Plays a clip or the finished video in place, from a temporary address that only this browser tab can use. */
  preview(source: 'video' | 'clip', id: string, title: string): void {
    const request = source === 'video' ? this.studio.downloadVideo(id) : this.studio.downloadClip(id);
    request.pipe(takeUntil(this.destroy$)).subscribe((blob) => {
      this.clearPreview();
      this.previewUrl = URL.createObjectURL(blob);
      // An address this tab just made for a file it downloaded itself, so it is safe to trust.
      this.previewSafeUrl = this.sanitizer.bypassSecurityTrustUrl(this.previewUrl);
      this.previewTitle = title;
    });
  }

  download(render: StoryRender): void {
    this.studio.downloadVideo(render.id).pipe(takeUntil(this.destroy$)).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.selected?.title ?? 'story'}.mp4`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  clearPreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = null;
    this.previewSafeUrl = null;
  }

  makeClips(): void {
    if (!this.selected || this.busy || (this.costsMoney && !this.confirmCost)) {
      return;
    }
    this.busy = true;
    this.studio
      .generateClips(this.selected.id, this.confirmCost)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe((scenes) => {
        this.scenes = scenes;
        this.confirmCost = false;
        this.refreshProjectStatus();
        this.pollWhileWorking();
      });
  }

  redo(s: StoryClipScene): void {
    if (this.busy || (this.costsMoney && !this.confirmCost)) {
      return;
    }
    this.busy = true;
    this.studio
      .regenerateScene(s.id, this.confirmCost)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.confirmCost = false;
        this.loadScenes();
      });
  }

  /** The Flow path: the user generated this scene in Flow and uploads the file. */
  uploadClip(s: StoryClipScene, input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .uploadClip(s.id, file)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success(`Clip for scene ${s.index} saved.`);
        this.loadScenes();
      });
  }

  startFlag(s: StoryClipScene): void {
    this.flagging = s.id;
    this.flagReason = '';
  }

  submitFlag(s: StoryClipScene): void {
    if (!this.flagReason.trim() || this.busy) {
      return;
    }
    this.busy = true;
    this.studio
      .flagScene(s.id, this.flagReason)
      .pipe(finalize(() => (this.busy = false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.flagging = null;
        this.loadScenes();
      });
  }

  private replace(project: StoryProject): void {
    this.selected = project;
    this.projects = this.projects.map((p) => (p.id === project.id ? project : p));
  }

  seconds(ms: number): string {
    return (ms / 1000).toFixed(1);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}

export interface ProblemOption {
  title: string;
  summary: string;
}

/**
 * A "Problems" fact is often one sentence listing several: "Problems our product solves: 1) Lead Discovery: Find customers.; 2) ...".
 * Splits each into a title (shown in the dropdown) and a summary (shown beside it).
 */
export function parseProblems(facts: { category: string; statement: string }[]): ProblemOption[] {
  const out: ProblemOption[] = [];
  for (const f of facts.filter((x) => /^problems?$/i.test((x.category ?? '').trim()))) {
    const statement = (f.statement ?? '').trim();
    const firstItem = statement.search(/(^|\s)1\)\s/);
    const parts = firstItem >= 0 ? statement.slice(firstItem).split(/(?:^|\s*;?\s+)\d+\)\s+/).filter((p) => p.trim()) : [statement];
    for (const raw of parts) {
      const text = raw.trim().replace(/[;\s]+$/, '');
      if (!text) {
        continue;
      }
      const colon = text.indexOf(':');
      const hasTitle = colon > 0 && colon < 80;
      const title = hasTitle ? text.slice(0, colon).trim() : text.length > 60 ? text.slice(0, 57) + '...' : text;
      const summary = hasTitle ? text.slice(colon + 1).trim() : text;
      out.push({ title, summary: summary || text });
    }
  }
  return out;
}

/** The topic sent to the script writer: the chosen problem and solution, then every other verified fact as instructions to follow. */
export function buildTopic(idea: { problem: string; solution: string }, facts: { category: string; subject: string | null; statement: string }[]): string {
  const head = `Problem: ${idea.problem}\nHow we solve it: ${idea.solution}`;
  const rest = facts
    .filter((f) => !/^problems?$/i.test((f.category ?? '').trim()))
    .map((f) => `- ${f.category}${f.subject ? ' / ' + f.subject : ''}: ${f.statement}`);
  if (!rest.length) {
    return head;
  }
  const out = `${head}\n\nBusiness facts to follow as instructions (use them exactly; do not contradict them):\n${rest.join('\n')}`;
  return out.length > 4000 ? out.slice(0, 3997) + '...' : out;
}

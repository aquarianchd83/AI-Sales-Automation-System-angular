import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';

import {
  CinematicScript,
  SCENE_VIDEO_PROVIDER_HINTS,
  SCENE_VIDEO_PROVIDER_LABELS,
  STORY_PROJECT_STATUS_LABELS,
  SceneVideoProviderKind,
  StoryCharacter,
  StoryCostEstimate,
  StoryProject,
  StoryProjectStatus,
  StoryScriptVersion,
} from '../../../core/models/story-studio.model';
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
  readonly languages = ['Hinglish', 'Hindi', 'English'];

  projects: StoryProject[] = [];
  characters: StoryCharacter[] = [];
  selected: StoryProject | null = null;
  creating = false;

  script: StoryScriptVersion | null = null;
  draft: CinematicScript | null = null;
  dirty = false;
  estimate: StoryCostEstimate | null = null;

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

  constructor(
    private readonly studio: StoryStudioService,
    private readonly notifications: NotificationService,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => this.loadCharacters());
  }

  ngOnDestroy(): void {
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
      });
  }

  private loadCharacters(): void {
    this.studio.listCharacters(this.search.value).pipe(takeUntil(this.destroy$)).subscribe((c) => (this.characters = c));
  }

  startNew(): void {
    this.creating = true;
    this.selected = null;
    this.script = null;
    this.draft = null;
    this.selectedCharacterIds.clear();
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
    if (project.currentScriptVersionId) {
      this.studio.getScript(project.id).pipe(takeUntil(this.destroy$)).subscribe((s) => this.showScript(s));
    }
    this.studio.getCostEstimate(project.id).pipe(takeUntil(this.destroy$)).subscribe((e) => (this.estimate = e));
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

import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  AssetCandidates,
  AssetKind,
  CLAIM_LABELS,
  ClaimStatus,
  ContentScene,
  ContentTopic,
  ContentTopicStatus,
  MAX_IMAGE_MB,
  PLANNER_LANGUAGES,
  ProjectDetail,
  ProjectSummary,
  SCRIPT_LENGTHS,
  ScriptVersion,
  ScriptVersionSummary,
  StockPhoto,
  StudioAsset,
} from '../../../core/models/content-planner.model';
import { ContentPlannerService } from '../../../core/services/content-planner.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Plans a video: pick a goal, let the AI suggest topics that rest on the facts the tenant has verified, choose one, and have it written scene
 * by scene. The tenant sees, for every scene, whether a verified fact backs what it says - worked out by the application, not claimed by the AI -
 * and can reword any scene. A script is a draft: nothing here approves or publishes it. The project list is on the left and the chosen project
 * opens on the right, so nobody leaves the page.
 */
@Component({
  selector: 'app-studio-planner',
  templateUrl: './studio-planner.component.html',
  styleUrls: ['./studio-planner.component.scss'],
})
export class StudioPlannerComponent implements OnInit, OnDestroy {
  readonly languages = PLANNER_LANGUAGES;
  readonly lengths = SCRIPT_LENGTHS;
  readonly claimLabels = CLAIM_LABELS;

  projects: ProjectSummary[] = [];
  loading = true;
  loadFailed = false;

  selectedId: string | null = null;
  detail: ProjectDetail | null = null;
  private shown: ScriptVersion | null = null;

  /** The script on show: the newest one unless the tenant opened an earlier version. */
  get version(): ScriptVersion | null {
    return this.shown;
  }

  set version(value: ScriptVersion | null) {
    this.shown = value;
    this.loadThumbs((value?.scenes ?? []).map((s) => s.asset?.id));
  }
  creating = false;

  busy = { project: false, topics: false, script: false, scene: false, recheck: false, pick: false, upload: false };
  editingSceneId: string | null = null;

  readonly newProject = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    goal: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000)] }),
    language: new FormControl('English', { nonNullable: true }),
  });

  readonly length = new FormControl(45, { nonNullable: true });
  readonly notes = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] });

  readonly sceneForm = new FormGroup({
    narration: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    onScreenText: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    durationSeconds: new FormControl(8, { nonNullable: true, validators: [Validators.required, Validators.min(2), Validators.max(30)] }),
    visualHint: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  // ----- the picture picker (one scene at a time, opened in place) ---------------------------------------------------------------

  readonly maxImageMb = MAX_IMAGE_MB;
  pickerSceneId: string | null = null;
  pickerTab: 'own' | 'stock' | 'upload' = 'own';
  candidates: AssetCandidates | null = null;
  /** Object URLs of pictures fetched through the API; revoked when the screen closes. */
  thumbs: Record<string, string> = {};
  private readonly thumbRequested = new Set<string>();
  pickedFile: File | null = null;
  fileProblem: string | null = null;
  readonly stockQuery = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] });
  readonly uploadForm = new FormGroup({
    kind: new FormControl<AssetKind>('Upload', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    tags: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    rights: new FormControl(false, { nonNullable: true }),
    personal: new FormControl(false, { nonNullable: true }),
  });

  constructor(
    private readonly planner: ContentPlannerService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    Object.values(this.thumbs).forEach((url) => URL.revokeObjectURL(url));
    this.thumbs = {};
  }

  // ----- reading -----------------------------------------------------------------------------------------------------------------

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.planner
      .list()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (projects) => {
          this.projects = projects;
          if (!this.selectedId && projects.length && !this.creating) {
            this.select(projects[0].id);
          }
        },
        error: () => (this.loadFailed = true),
      });
  }

  select(id: string): void {
    this.creating = false;
    this.selectedId = id;
    this.detail = null;
    this.version = null;
    this.editingSceneId = null;
    this.planner.get(id).subscribe({ next: (d) => this.show(d), error: () => undefined });
  }

  private show(detail: ProjectDetail): void {
    this.detail = detail;
    this.version = detail.currentVersion;
    this.editingSceneId = null;
    this.refreshList();
  }

  private refreshList(): void {
    this.planner.list().subscribe({ next: (projects) => (this.projects = projects), error: () => undefined });
  }

  get chosenTopic(): ContentTopic | null {
    return this.detail?.topics.find((t) => t.status === 'Chosen') ?? null;
  }

  get liveTopics(): ContentTopic[] {
    return this.detail?.topics.filter((t) => t.status !== 'Rejected') ?? [];
  }

  get rejectedTopics(): ContentTopic[] {
    return this.detail?.topics.filter((t) => t.status === 'Rejected') ?? [];
  }

  get hasFacts(): boolean {
    return (this.detail?.usableFacts ?? 0) > 0;
  }

  get canSuggest(): boolean {
    return this.hasFacts && !this.busy.topics;
  }

  get canWrite(): boolean {
    return this.hasFacts && !!this.chosenTopic && !this.busy.script && this.notes.valid;
  }

  get isNewestVersion(): boolean {
    return !!this.version && this.version.id === this.detail?.currentVersion?.id;
  }

  get editable(): boolean {
    return this.version?.status === 'Draft';
  }

  claimClass(status: ClaimStatus): string {
    return `claim claim--${status.toLowerCase()}`;
  }

  /** A scene to look at: a claim with no verified fact behind it. */
  needsFact(scene: ContentScene): boolean {
    return scene.claimStatus === 'Unsupported' || scene.claimStatus === 'Unverified';
  }

  // ----- projects ----------------------------------------------------------------------------------------------------------------

  startNew(): void {
    this.creating = true;
    this.selectedId = null;
    this.detail = null;
    this.version = null;
    this.newProject.reset({ title: '', goal: '', language: 'English' });
  }

  createProject(): void {
    if (this.newProject.invalid || this.busy.project) {
      return;
    }
    this.busy = { ...this.busy, project: true };
    const value = this.newProject.getRawValue();
    this.planner
      .create({ title: value.title.trim(), goal: value.goal.trim(), language: value.language })
      .pipe(finalize(() => (this.busy = { ...this.busy, project: false })))
      .subscribe({
        next: (d) => {
          this.creating = false;
          this.selectedId = d.id;
          this.show(d);
          this.notify.success('Project created. Now ask for topic ideas.');
        },
        error: () => undefined,
      });
  }

  removeProject(): void {
    const detail = this.detail;
    if (!detail) {
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Delete this project?',
      message: `"${detail.title}" and its topics and scripts are removed from your list.`,
      confirmLabel: 'Delete',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.planner.remove(detail.id).subscribe({
          next: () => {
            this.projects = this.projects.filter((p) => p.id !== detail.id);
            this.selectedId = null;
            this.detail = null;
            this.version = null;
            this.notify.success('Project deleted.');
            if (this.projects.length) {
              this.select(this.projects[0].id);
            }
          },
          error: () => undefined,
        });
      });
  }

  // ----- topics ------------------------------------------------------------------------------------------------------------------

  suggestTopics(): void {
    if (!this.detail || !this.canSuggest) {
      return;
    }
    this.busy = { ...this.busy, topics: true };
    this.planner
      .generateTopics(this.detail.id, null)
      .pipe(finalize(() => (this.busy = { ...this.busy, topics: false })))
      .subscribe({
        next: (d) => {
          this.keepVersionAnd(d);
          this.notify.success('Topic ideas added.');
        },
        // ErrorInterceptor shows why (no verified facts, quota used up, the AI failed - and that nothing was charged).
        error: () => undefined,
      });
  }

  setTopic(topic: ContentTopic, status: ContentTopicStatus): void {
    this.planner.updateTopic(topic.id, { status }).subscribe({ next: (d) => this.keepVersionAnd(d), error: () => undefined });
  }

  /** Topics change, but the script on show stays as it is. */
  private keepVersionAnd(detail: ProjectDetail): void {
    const keep = this.version;
    this.show(detail);
    if (keep && detail.currentVersion?.id !== keep.id && detail.versions.some((v) => v.id === keep.id)) {
      this.version = keep;
    }
  }

  // ----- scripts -----------------------------------------------------------------------------------------------------------------

  writeScript(): void {
    if (!this.detail || !this.canWrite) {
      return;
    }
    this.busy = { ...this.busy, script: true };
    this.planner
      .generateScript(this.detail.id, { topicId: this.chosenTopic?.id ?? null, targetSeconds: this.length.value, notes: this.notes.value.trim() || null })
      .pipe(finalize(() => (this.busy = { ...this.busy, script: false })))
      .subscribe({
        next: (d) => {
          this.show(d);
          this.notes.reset('');
          this.notify.success(`Script version ${d.currentVersion?.number} written.`);
        },
        error: () => undefined,
      });
  }

  openVersion(summary: ScriptVersionSummary): void {
    if (this.version?.id === summary.id) {
      return;
    }
    this.editingSceneId = null;
    this.planner.getVersion(summary.id).subscribe({ next: (v) => (this.version = v), error: () => undefined });
  }

  recheck(): void {
    if (!this.version || this.busy.recheck) {
      return;
    }
    this.busy = { ...this.busy, recheck: true };
    this.planner
      .recheck(this.version.id)
      .pipe(finalize(() => (this.busy = { ...this.busy, recheck: false })))
      .subscribe({
        next: (v) => {
          this.version = v;
          this.notify.success('Every scene was checked again against your facts.');
        },
        error: () => undefined,
      });
  }

  // ----- scenes ------------------------------------------------------------------------------------------------------------------

  editScene(scene: ContentScene): void {
    this.editingSceneId = scene.id;
    this.sceneForm.reset({ narration: scene.narration, onScreenText: scene.onScreenText ?? '', durationSeconds: scene.durationSeconds, visualHint: scene.visualHint ?? '' });
  }

  cancelEdit(): void {
    this.editingSceneId = null;
  }

  saveScene(): void {
    if (!this.editingSceneId || this.sceneForm.invalid || this.busy.scene) {
      return;
    }
    const value = this.sceneForm.getRawValue();
    this.busy = { ...this.busy, scene: true };
    this.planner
      .updateScene(this.editingSceneId, {
        narration: value.narration.trim(),
        onScreenText: value.onScreenText.trim() || null,
        durationSeconds: value.durationSeconds,
        visualHint: value.visualHint.trim() || null,
      })
      .pipe(finalize(() => (this.busy = { ...this.busy, scene: false })))
      .subscribe({
        next: (v) => {
          this.version = v;
          this.editingSceneId = null;
          this.notify.success('Scene saved and checked against your facts.');
        },
        error: () => undefined,
      });
  }

  // ----- pictures ----------------------------------------------------------------------------------------------------------------

  /** Fetches each picture once, through the API, and keeps it as an object URL. */
  private loadThumbs(ids: (string | undefined)[]): void {
    for (const id of ids) {
      if (!id || this.thumbRequested.has(id)) {
        continue;
      }
      this.thumbRequested.add(id);
      this.planner.assetContent(id).subscribe({
        next: (blob) => (this.thumbs = { ...this.thumbs, [id]: URL.createObjectURL(blob) }),
        error: () => this.thumbRequested.delete(id),
      });
    }
  }

  get picking(): ContentScene | null {
    return this.version?.scenes.find((s) => s.id === this.pickerSceneId) ?? null;
  }

  get needsPersonalDataCheck(): boolean {
    return this.uploadForm.controls.kind.value === 'Screenshot';
  }

  get canUpload(): boolean {
    return (
      !!this.pickedFile &&
      !this.fileProblem &&
      this.uploadForm.valid &&
      this.uploadForm.controls.rights.value &&
      (!this.needsPersonalDataCheck || this.uploadForm.controls.personal.value) &&
      !this.busy.upload
    );
  }

  openPicker(scene: ContentScene): void {
    this.editingSceneId = null;
    this.pickerSceneId = scene.id;
    this.pickerTab = 'own';
    this.candidates = null;
    this.stockQuery.reset('');
    this.resetUpload();
    this.fetchCandidates(false);
  }

  closePicker(): void {
    this.pickerSceneId = null;
    this.candidates = null;
  }

  setPickerTab(tab: 'own' | 'stock' | 'upload'): void {
    this.pickerTab = tab;
    if (tab === 'stock' && this.candidates && !this.candidates.stock.length && this.candidates.stockAvailable && !this.candidates.stockMessage) {
      this.searchStock();
    }
  }

  private fetchCandidates(includeStock: boolean, query: string | null = null): void {
    const sceneId = this.pickerSceneId;
    if (!sceneId) {
      return;
    }
    this.busy = { ...this.busy, pick: true };
    this.planner
      .candidates(sceneId, includeStock, query)
      .pipe(finalize(() => (this.busy = { ...this.busy, pick: false })))
      .subscribe({
        next: (c) => {
          if (this.pickerSceneId !== sceneId) {
            return;
          }
          this.candidates = c;
          if (!this.stockQuery.value) {
            this.stockQuery.setValue(c.query, { emitEvent: false });
          }
          this.loadThumbs(c.own.map((o) => o.asset.id));
        },
        error: () => undefined,
      });
  }

  searchStock(): void {
    this.fetchCandidates(true, this.stockQuery.value.trim() || null);
  }

  useOwn(asset: StudioAsset): void {
    this.choose({ assetId: asset.id, stockProviderAssetId: null });
  }

  useStock(photo: StockPhoto): void {
    this.choose({ assetId: null, stockProviderAssetId: photo.providerAssetId });
  }

  private choose(body: { assetId: string | null; stockProviderAssetId: string | null }): void {
    const sceneId = this.pickerSceneId;
    if (!sceneId || this.busy.pick) {
      return;
    }
    this.busy = { ...this.busy, pick: true };
    this.planner
      .chooseAsset(sceneId, body)
      .pipe(finalize(() => (this.busy = { ...this.busy, pick: false })))
      .subscribe({
        next: (summary) => {
          if (this.version) {
            const scenes = this.version.scenes.map((s) => (s.id === sceneId ? { ...s, asset: summary } : s));
            this.version = { ...this.version, scenes, scenesWithoutPicture: scenes.filter((s) => !s.asset).length };
          }
          this.closePicker();
          this.notify.success('Picture chosen.');
        },
        // ErrorInterceptor shows why (not a draft any more, the stock photo is gone, storage not set up).
        error: () => undefined,
      });
  }

  clearPicture(scene: ContentScene): void {
    this.planner.clearAsset(scene.id).subscribe({
      next: () => {
        if (this.version) {
          const scenes = this.version.scenes.map((s) => (s.id === scene.id ? { ...s, asset: null } : s));
          this.version = { ...this.version, scenes, scenesWithoutPicture: scenes.filter((s) => !s.asset).length };
        }
      },
      error: () => undefined,
    });
  }

  onFileChosen(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.pickedFile = file;
    this.fileProblem = null;
    if (!file) {
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      this.fileProblem = 'Only JPEG, PNG and WebP pictures can be used.';
    } else if (file.size > this.maxImageMb * 1024 * 1024) {
      this.fileProblem = `The picture is larger than ${this.maxImageMb} MB.`;
    }
  }

  upload(): void {
    if (!this.canUpload || !this.pickedFile) {
      return;
    }
    const value = this.uploadForm.getRawValue();
    const form = new FormData();
    form.append('file', this.pickedFile);
    form.append('kind', value.kind);
    form.append('name', value.name.trim());
    form.append('tags', value.tags.trim());
    form.append('rightsConfirmed', String(value.rights));
    form.append('personalDataChecked', String(value.personal));
    this.busy = { ...this.busy, upload: true };
    this.planner
      .uploadAsset(form)
      .pipe(finalize(() => (this.busy = { ...this.busy, upload: false })))
      .subscribe({
        next: (asset) => {
          this.notify.success('Picture added to your library.');
          this.resetUpload();
          this.pickerTab = 'own';
          this.fetchCandidates(false, this.candidates?.query ?? null);
          this.loadThumbs([asset.id]);
        },
        error: () => undefined,
      });
  }

  private resetUpload(): void {
    this.pickedFile = null;
    this.fileProblem = null;
    this.uploadForm.reset({ kind: 'Upload', name: '', tags: '', rights: false, personal: false });
  }

  deleteScene(scene: ContentScene): void {
    const data: ConfirmDialogData = { title: 'Remove this scene?', message: `Scene ${scene.order} is taken out of this script.`, confirmLabel: 'Remove' };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.planner.deleteScene(scene.id).subscribe({ next: (v) => (this.version = v), error: () => undefined });
        }
      });
  }
}

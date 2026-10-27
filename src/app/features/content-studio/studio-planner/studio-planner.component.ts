import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  CLAIM_LABELS,
  ClaimStatus,
  ContentScene,
  ContentTopic,
  ContentTopicStatus,
  PLANNER_LANGUAGES,
  ProjectDetail,
  ProjectSummary,
  SCRIPT_LENGTHS,
  ScriptVersion,
  ScriptVersionSummary,
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
export class StudioPlannerComponent implements OnInit {
  readonly languages = PLANNER_LANGUAGES;
  readonly lengths = SCRIPT_LENGTHS;
  readonly claimLabels = CLAIM_LABELS;

  projects: ProjectSummary[] = [];
  loading = true;
  loadFailed = false;

  selectedId: string | null = null;
  detail: ProjectDetail | null = null;
  /** The script on show: the newest one unless the tenant opened an earlier version. */
  version: ScriptVersion | null = null;
  creating = false;

  busy = { project: false, topics: false, script: false, scene: false, recheck: false };
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

  constructor(
    private readonly planner: ContentPlannerService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.load();
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

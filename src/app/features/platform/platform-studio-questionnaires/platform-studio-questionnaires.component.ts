import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  AnswerMap,
  QuestionnaireDefinition,
  QuestionnaireTemplateDetail,
  QuestionnaireTemplateSummary,
  QuestionnaireValidation,
  QuestionnaireVersion,
  QuestionnaireVersionStatus,
} from '../../../core/models/content-studio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformStudioQuestionnaireService } from '../../../core/services/platform-studio-questionnaire.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

type PanelMode = 'none' | 'new' | 'edit';

/**
 * The platform operator's questionnaire templates for the AI Content Studio: what every tenant (or every tenant of one industry)
 * is asked. Templates are versioned; a published version is never edited - a change is a new version - so what a tenant answered
 * always means what it meant when it was answered. The definition is JSON with a validator and a live preview of exactly what a
 * tenant would see, so industry knowledge is authored here as data and never as code.
 */
@Component({
  selector: 'app-platform-studio-questionnaires',
  templateUrl: './platform-studio-questionnaires.component.html',
  styleUrls: ['./platform-studio-questionnaires.component.scss'],
})
export class PlatformStudioQuestionnairesComponent implements OnInit {
  readonly statusEnum = QuestionnaireVersionStatus;

  readonly meta = this.fb.group({
    key: ['', [Validators.required, Validators.pattern(/^[a-z][a-z0-9-]{1,59}$/)]],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    industry: ['', [Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    isActive: [true],
  });

  templates: QuestionnaireTemplateSummary[] = [];
  detail: QuestionnaireTemplateDetail | null = null;
  panel: PanelMode = 'none';

  /** The version being looked at, and the text of its definition as it is now in the editor. */
  version: QuestionnaireVersion | null = null;
  json = '';
  validation: QuestionnaireValidation | null = null;
  view: 'definition' | 'preview' = 'definition';
  previewAnswers: AnswerMap = {};

  loading = true;
  busy = false;

  constructor(
    private readonly service: PlatformStudioQuestionnaireService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog,
    private readonly fb: NonNullableFormBuilder
  ) {}

  ngOnInit(): void {
    this.loadList();
  }

  get isNew(): boolean {
    return this.panel === 'new';
  }

  get isDraft(): boolean {
    return this.isNew || this.version?.status === QuestionnaireVersionStatus.Draft;
  }

  get hasDraft(): boolean {
    return !!this.detail?.versions.some((v) => v.status === QuestionnaireVersionStatus.Draft);
  }

  get jsonDirty(): boolean {
    return !!this.version && this.json !== this.version.definitionJson;
  }

  /** The definition as the editor currently reads it, for the preview; null while the text is not valid JSON. */
  get previewDefinition(): QuestionnaireDefinition | null {
    try {
      const parsed = JSON.parse(this.json) as QuestionnaireDefinition;
      return parsed && Array.isArray(parsed.questions) ? parsed : null;
    } catch {
      return null;
    }
  }

  select(summary: QuestionnaireTemplateSummary): void {
    this.busy = true;
    this.service
      .get(summary.id)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((detail) => this.show(detail));
  }

  startNew(): void {
    this.panel = 'new';
    this.detail = null;
    this.version = null;
    this.validation = null;
    this.view = 'definition';
    this.previewAnswers = {};
    this.meta.reset({ key: '', title: '', industry: '', description: '', isActive: true });
    this.meta.controls.key.enable();
    this.json = '';
    this.loadStarter();
  }

  loadStarter(): void {
    this.service.getStarter().subscribe((starter) => {
      this.json = starter.definitionJson;
      this.validation = null;
    });
  }

  pickVersion(version: QuestionnaireVersion): void {
    this.version = version;
    this.json = version.definitionJson;
    this.validation = null;
    this.previewAnswers = {};
  }

  validate(): void {
    this.busy = true;
    this.service
      .validate(this.json)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((result) => {
        this.validation = result;
        if (result.valid) {
          this.notify.success(`Valid: ${result.questionCount} question(s).`);
        }
      });
  }

  /** Creates the template from the form and the editor text. */
  create(): void {
    if (this.meta.invalid || this.busy) {
      this.meta.markAllAsTouched();
      return;
    }

    const value = this.meta.getRawValue();
    this.busy = true;
    this.service
      .create({
        key: value.key.trim(),
        title: value.title.trim(),
        description: value.description.trim() || null,
        industry: value.industry.trim() || null,
        definitionJson: this.json,
      })
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((detail) => {
        this.notify.success('Template created as a draft. Publish it when it is ready.');
        this.show(detail);
        this.loadList();
      });
  }

  saveDetails(): void {
    if (!this.detail || this.meta.invalid || this.busy) {
      return;
    }

    const value = this.meta.getRawValue();
    this.busy = true;
    this.service
      .update(this.detail.template.id, {
        title: value.title.trim(),
        description: value.description.trim() || null,
        industry: value.industry.trim() || null,
        isActive: value.isActive,
      })
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((detail) => {
        this.notify.success('Template details saved.');
        this.show(detail, this.version?.number);
        this.loadList();
      });
  }

  saveDraft(): void {
    if (!this.detail || !this.version || !this.jsonDirty || this.busy) {
      return;
    }

    this.busy = true;
    this.service
      .saveVersion(this.detail.template.id, this.version.number, this.json)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((detail) => {
        this.notify.success('Draft saved.');
        this.show(detail, this.version?.number);
      });
  }

  newVersion(): void {
    if (!this.detail || this.hasDraft || this.busy) {
      return;
    }

    this.busy = true;
    this.service
      .createVersion(this.detail.template.id)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((detail) => {
        this.notify.success('New draft version created from the latest.');
        this.show(detail);
        this.loadList();
      });
  }

  publish(): void {
    if (!this.detail || !this.version || this.version.status !== QuestionnaireVersionStatus.Draft || this.busy) {
      return;
    }
    if (this.jsonDirty) {
      this.notify.error('Save the draft before publishing it.');
      return;
    }

    const template = this.detail.template;
    const number = this.version.number;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Publish version ${number}?`,
          message: `Tenants will be offered version ${number} of "${template.title}" from now on. A published version can never be edited - any change after this is a new version.`,
          confirmLabel: 'Publish',
        },
        width: '460px',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.busy = true;
        this.service
          .publishVersion(template.id, number)
          .pipe(finalize(() => (this.busy = false)))
          .subscribe((detail) => {
            this.notify.success(`Version ${number} published.`);
            this.show(detail, number);
            this.loadList();
          });
      });
  }

  close(): void {
    this.panel = 'none';
    this.detail = null;
    this.version = null;
  }

  private show(detail: QuestionnaireTemplateDetail, keepVersion?: number): void {
    this.panel = 'edit';
    this.detail = detail;
    this.view = 'definition';
    this.validation = null;
    this.previewAnswers = {};

    const t = detail.template;
    this.meta.reset({ key: t.key, title: t.title, industry: t.industry ?? '', description: t.description ?? '', isActive: t.isActive });
    this.meta.controls.key.disable();

    const draft = detail.versions.find((v) => v.status === QuestionnaireVersionStatus.Draft);
    const chosen = (keepVersion != null ? detail.versions.find((v) => v.number === keepVersion) : undefined) ?? draft ?? detail.versions[0] ?? null;
    this.version = chosen;
    this.json = chosen?.definitionJson ?? '';
  }

  private loadList(): void {
    this.loading = true;
    this.service
      .list()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (templates) => (this.templates = templates) });
  }
}

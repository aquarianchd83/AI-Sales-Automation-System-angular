import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  KnowledgeBaseArticle,
  KnowledgeBaseSourceType,
  sourceTypeDisplayName,
} from '../../../core/models/knowledge-base.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformKnowledgeService } from '../../../core/services/platform-knowledge.service';

export interface PlatformKnowledgeFormData {
  mode: 'create' | 'edit';
  article?: KnowledgeBaseArticle;
}

@Component({
  selector: 'app-platform-knowledge-form-dialog',
  templateUrl: './platform-knowledge-form-dialog.component.html',
  styleUrls: ['./platform-knowledge-form-dialog.component.scss'],
})
export class PlatformKnowledgeFormDialogComponent {
  readonly isEdit = this.data.mode === 'edit';
  /** A platform author may use every source type - it decides the article's authority rank. */
  readonly sourceTypes = Object.values(KnowledgeBaseSourceType);
  readonly sourceTypeLabel = sourceTypeDisplayName;

  readonly form = this.fb.nonNullable.group({
    title: [this.data.article?.title ?? '', [Validators.required, Validators.maxLength(200)]],
    category: [this.data.article?.category ?? '', [Validators.maxLength(100)]],
    content: [this.data.article?.content ?? '', [Validators.required, Validators.maxLength(20000)]],
    sourceType: [this.data.article?.sourceType ?? KnowledgeBaseSourceType.ProductDocumentation],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformKnowledgeFormData,
    private readonly fb: FormBuilder,
    private readonly articles: PlatformKnowledgeService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformKnowledgeFormDialogComponent, boolean>
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const saved$: Observable<KnowledgeBaseArticle> =
      this.isEdit && this.data.article
        ? this.articles.update(this.data.article.id, {
            title: raw.title.trim(),
            category: raw.category.trim() || null,
            content: raw.content,
          })
        : this.articles.create({
            title: raw.title.trim(),
            category: raw.category.trim() || null,
            content: raw.content,
            sourceType: raw.sourceType,
          });

    this.saving = true;
    saved$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(
          this.isEdit ? 'Article updated.' : 'Article created as Draft - publish it to make it available to every tenant.'
        );
        this.dialogRef.close(true);
      },
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

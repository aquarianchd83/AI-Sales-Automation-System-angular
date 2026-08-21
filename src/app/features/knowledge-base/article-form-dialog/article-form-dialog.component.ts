import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { KnowledgeBaseArticle, KnowledgeBaseSourceType } from '../../../core/models/knowledge-base.model';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface ArticleFormDialogData {
  mode: 'create' | 'edit';
  article?: KnowledgeBaseArticle;
}

@Component({
  selector: 'app-article-form-dialog',
  templateUrl: './article-form-dialog.component.html',
  styleUrls: ['./article-form-dialog.component.scss'],
})
export class ArticleFormDialogComponent {
  readonly isEdit = this.data.mode === 'edit';
  readonly sourceTypes = Object.values(KnowledgeBaseSourceType);

  readonly form = this.fb.nonNullable.group({
    title: [this.data.article?.title ?? '', [Validators.required, Validators.maxLength(200)]],
    category: [this.data.article?.category ?? '', [Validators.maxLength(100)]],
    content: [this.data.article?.content ?? '', [Validators.required, Validators.maxLength(20000)]],
    sourceType: [this.data.article?.sourceType ?? KnowledgeBaseSourceType.Manual],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ArticleFormDialogData,
    private readonly fb: FormBuilder,
    private readonly articles: KnowledgeBaseService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<ArticleFormDialogComponent, boolean>
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
        this.notify.success(this.isEdit ? 'Article updated.' : 'Article created as Draft — publish it to make it retrievable.');
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

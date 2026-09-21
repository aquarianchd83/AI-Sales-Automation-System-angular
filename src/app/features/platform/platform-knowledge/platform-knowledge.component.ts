import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import {
  KnowledgeBaseArticle,
  KnowledgeBaseArticleStatus,
  knowledgeBaseStatusChipClass,
  sourceTypeDisplayName,
} from '../../../core/models/knowledge-base.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformEmbeddingStatus, PlatformKnowledgeService } from '../../../core/services/platform-knowledge.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformKnowledgeDeprecateDialogComponent } from '../platform-knowledge-deprecate-dialog/platform-knowledge-deprecate-dialog.component';
import {
  PlatformKnowledgeFormData,
  PlatformKnowledgeFormDialogComponent,
} from '../platform-knowledge-form-dialog/platform-knowledge-form-dialog.component';

/** The platform's own knowledge base: articles the AI support agent uses when any tenant asks about
 * the product itself. Same lifecycle as a tenant's Knowledge Base, but the platform pays to embed. */
@Component({
  selector: 'app-platform-knowledge',
  templateUrl: './platform-knowledge.component.html',
  styleUrls: ['./platform-knowledge.component.scss'],
})
export class PlatformKnowledgeComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['title', 'category', 'source', 'status', 'version', 'chunkCount', 'updatedAt', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusClass = knowledgeBaseStatusChipClass;
  readonly sourceLabel = sourceTypeDisplayName;
  readonly statusFilters: { label: string; value: string | null }[] = [
    { label: 'All', value: null },
    { label: 'Draft', value: KnowledgeBaseArticleStatus.Draft },
    { label: 'Published', value: KnowledgeBaseArticleStatus.Published },
    { label: 'Deprecated', value: KnowledgeBaseArticleStatus.Deprecated },
  ];

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<KnowledgeBaseArticle> = emptyPage<KnowledgeBaseArticle>();
  embedding: PlatformEmbeddingStatus | null = null;
  loading = true;
  reindexing = false;
  uploading = false;
  statusFilter: string | null = null;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly articles: PlatformKnowledgeService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadEmbeddingStatus();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.articles.getPaged(this.query, this.statusFilter ?? undefined).pipe(
            catchError(() => of(emptyPage<KnowledgeBaseArticle>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  setStatusFilter(value: string | null): void {
    if (this.statusFilter === value) {
      return;
    }
    this.statusFilter = value;
    this.query = { ...this.query, page: 1 };
    this.paginator?.firstPage();
    this.reload$.next();
  }

  canPublish(article: KnowledgeBaseArticle): boolean {
    return article.status !== KnowledgeBaseArticleStatus.Deprecated && article.status !== KnowledgeBaseArticleStatus.Archived;
  }

  canDeprecate(article: KnowledgeBaseArticle): boolean {
    return article.status === KnowledgeBaseArticleStatus.Published;
  }

  create(): void {
    this.openForm({ mode: 'create' });
  }

  edit(article: KnowledgeBaseArticle): void {
    this.openForm({ mode: 'edit', article });
  }

  publish(article: KnowledgeBaseArticle): void {
    this.articles.publish(article.id).subscribe({
      next: () => {
        this.notify.success(`"${article.title}" published - every tenant's support agent can now use it.`);
        this.reload$.next();
      },
      error: () => {
        // ErrorInterceptor toasts it (including a refused-content explanation).
      },
    });
  }

  deprecate(article: KnowledgeBaseArticle): void {
    this.dialog
      .open<PlatformKnowledgeDeprecateDialogComponent, { title: string }, string>(PlatformKnowledgeDeprecateDialogComponent, {
        data: { title: article.title },
        width: '460px',
      })
      .afterClosed()
      .subscribe((note) => {
        if (!note) {
          return;
        }
        this.articles.deprecate(article.id, note).subscribe(() => {
          this.notify.success(`"${article.title}" deprecated - tenants no longer see it in answers.`);
          this.reload$.next();
        });
      });
  }

  delete(article: KnowledgeBaseArticle): void {
    const data: ConfirmDialogData = {
      title: `Delete "${article.title}"?`,
      message: 'This cannot be undone. Its chunks are removed too, so no tenant\'s support agent can cite it any more.',
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.articles.delete(article.id).subscribe(() => {
          this.notify.success('Article deleted.');
          this.reload$.next();
        });
      });
  }

  reindexAll(): void {
    this.reindexing = true;
    this.articles
      .reindex()
      .pipe(finalize(() => (this.reindexing = false)))
      .subscribe({
        next: () => {
          this.notify.success('Re-index complete - stale platform articles were re-embedded.');
          this.loadEmbeddingStatus();
          this.reload$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Creates a Draft from the chosen file - nothing is published until it has been read and reviewed. */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading) {
      return;
    }

    this.uploading = true;
    this.articles
      .upload(file)
      .pipe(finalize(() => (this.uploading = false)))
      .subscribe({
        next: (result) => {
          this.notify.success(`"${result.article.title}" created as Draft from ${file.name} - review it, then publish.`);
          this.reload$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  private loadEmbeddingStatus(): void {
    this.articles
      .getEmbeddingStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => (this.embedding = status),
        error: () => (this.embedding = null),
      });
  }

  private openForm(data: PlatformKnowledgeFormData): void {
    this.dialog
      .open(PlatformKnowledgeFormDialogComponent, { data, width: '680px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }
}

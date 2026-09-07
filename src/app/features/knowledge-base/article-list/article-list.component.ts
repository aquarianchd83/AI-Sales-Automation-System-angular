import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import {
  AI_MODEL_PROVIDERS,
  AiModelProvider,
  EMBEDDING_PROVIDERS,
  EmbeddingProviderName,
  KnowledgeBaseArticle,
  KnowledgeBaseArticleStatus,
  aiModelDisplayName,
  canPublishArticle,
  knowledgeBaseStatusChipClass,
} from '../../../core/models/knowledge-base.model';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { ArticleFormDialogComponent, ArticleFormDialogData } from '../article-form-dialog/article-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-article-list',
  templateUrl: './article-list.component.html',
  styleUrls: ['./article-list.component.scss'],
})
export class ArticleListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = [
    'select',
    'title',
    'category',
    'status',
    'models',
    'embeddings',
    'version',
    'chunkCount',
    'updatedAt',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusClass = knowledgeBaseStatusChipClass;
  readonly canPublish = canPublishArticle;
  readonly modelLabel = aiModelDisplayName;

  /** Filtered down to what GetAvailableProviders reports has an API key configured — default to
   * the full lists until that call returns, so badges don't flash empty on a slow connection; a
   * deployment with nothing configured (all Simulated) will briefly show every badge, then narrow
   * to just "Simulated" once the response arrives. */
  availableModels: AiModelProvider[] = AI_MODEL_PROVIDERS;
  availableEmbeddingProviders: EmbeddingProviderName[] = EMBEDDING_PROVIDERS;
  readonly statusFilters: { label: string; value: string | null }[] = [
    { label: 'All', value: null },
    { label: 'Draft', value: KnowledgeBaseArticleStatus.Draft },
    { label: 'Published', value: KnowledgeBaseArticleStatus.Published },
    { label: 'Archived', value: KnowledgeBaseArticleStatus.Archived },
  ];

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  /**
   * Scoped to the current page, same reasoning as CustomerListComponent's selection: the API
   * pages server-side with no "select everything matching this filter", so a selection that
   * survived paging would let someone publish rows they never actually saw.
   */
  readonly selection = new SelectionModel<KnowledgeBaseArticle>(true, []);

  page: PagedResult<KnowledgeBaseArticle> = emptyPage<KnowledgeBaseArticle>();
  loading = true;
  reindexing = false;
  bulkPublishing = false;
  statusFilter: string | null = null;

  /** Keyed by `${articleId}:${provider}` — tracks which single model badge is mid-toggle so only
   * that badge disables/spins, not the whole row. */
  private readonly modelToggling = new Set<string>();

  /** Same keying as modelToggling, for the separate embedding-provider badge row. */
  private readonly embeddingToggling = new Set<string>();

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly articles: KnowledgeBaseService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.articles
      .getAvailableProviders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (available) => {
          this.availableModels = AI_MODEL_PROVIDERS.filter((m) => available.chatModels.includes(m));
          this.availableEmbeddingProviders = EMBEDDING_PROVIDERS.filter((p) => available.embeddingProviders.includes(p));
        },
        // Leave the full default lists in place — see their own doc comment — rather than hiding
        // every badge just because this one auxiliary call failed.
        error: () => {},
      });

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
      .subscribe((page) => {
        this.page = page;
        // Rows are new object references after every fetch, so a stale selection could never
        // match them anyway — clear it rather than leave it dangling.
        this.selection.clear();
      });
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

  // ---- selection ----------------------------------------------------------

  /** Archived rows are excluded — nothing can publish one, so "select all" should not offer
   * to try, same reasoning as the per-row Publish button being disabled for them. */
  get publishableOnPage(): KnowledgeBaseArticle[] {
    return this.page.items.filter((a) => this.canPublish(a.status));
  }

  get allPublishableOnPageSelected(): boolean {
    return this.publishableOnPage.length > 0 && this.publishableOnPage.every((a) => this.selection.isSelected(a));
  }

  get somePublishableOnPageSelected(): boolean {
    return this.selection.hasValue() && !this.allPublishableOnPageSelected;
  }

  toggleAllOnPage(): void {
    if (this.allPublishableOnPageSelected) {
      this.selection.clear();
    } else {
      this.selection.select(...this.publishableOnPage);
    }
  }

  /** Publishes every selected article in one request — see BulkPublishArticlesResult for why
   * this can partially succeed instead of all-or-nothing. */
  publishSelected(): void {
    const selected = this.selection.selected;
    if (!selected.length || this.bulkPublishing) {
      return;
    }

    this.bulkPublishing = true;
    this.articles
      .bulkPublish(selected.map((a) => a.id))
      .pipe(finalize(() => (this.bulkPublishing = false)))
      .subscribe({
        next: (result) => {
          const missed = result.requestedCount - result.publishedCount;
          if (missed > 0) {
            const reasons = [
              result.failedIds.length > 0 ? `${result.failedIds.length} failed to embed` : null,
              result.notFoundIds.length > 0 ? `${result.notFoundIds.length} no longer exist` : null,
            ].filter(Boolean);
            this.notify.info(`Published ${result.publishedCount} of ${result.requestedCount} (${reasons.join(', ')}).`);
          } else {
            this.notify.success(`Published ${result.publishedCount} article${result.publishedCount === 1 ? '' : 's'}.`);
          }
          this.selection.clear();
          this.reload$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it; keep the selection so it can be retried.
        },
      });
  }

  create(): void {
    this.openForm({ mode: 'create' });
  }

  edit(article: KnowledgeBaseArticle, event: Event): void {
    event.stopPropagation();
    this.openForm({ mode: 'edit', article });
  }

  publish(article: KnowledgeBaseArticle, event: Event): void {
    event.stopPropagation();
    this.articles.publish(article.id).subscribe({
      next: () => {
        this.notify.success(`"${article.title}" published — chunked and embedded via every available provider.`);
        this.reload$.next();
      },
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  isPublishedTo(article: KnowledgeBaseArticle, provider: AiModelProvider): boolean {
    return article.publishedModels.some((m) => m.provider === provider);
  }

  isModelToggling(article: KnowledgeBaseArticle, provider: AiModelProvider): boolean {
    return this.modelToggling.has(this.modelKey(article, provider));
  }

  /** Toggles one article's eligibility for one AI model — no confirm dialog, unlike delete: this
   * is trivially reversible by toggling again. */
  toggleModel(article: KnowledgeBaseArticle, provider: AiModelProvider, event: Event): void {
    event.stopPropagation();
    const key = this.modelKey(article, provider);
    if (this.modelToggling.has(key)) {
      return;
    }

    const wasPublished = this.isPublishedTo(article, provider);
    const request = wasPublished
      ? this.articles.unpublishFromModel(article.id, provider)
      : this.articles.publishToModel(article.id, provider);

    this.modelToggling.add(key);
    request.pipe(finalize(() => this.modelToggling.delete(key))).subscribe({
      next: (updated) => {
        article.publishedModels = updated.publishedModels;
        article.status = updated.status;
        article.chunkCount = updated.chunkCount;
        this.notify.success(
          wasPublished
            ? `"${article.title}" unpublished from ${this.modelLabel(provider)}.`
            : `"${article.title}" published to ${this.modelLabel(provider)}.`
        );
      },
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  private modelKey(article: KnowledgeBaseArticle, provider: string): string {
    return `${article.id}:${provider}`;
  }

  embeddedVia(article: KnowledgeBaseArticle, provider: EmbeddingProviderName): { model: string; embeddedAt: string } | undefined {
    return article.embeddedProviders.find((e) => e.provider === provider);
  }

  isEmbeddingToggling(article: KnowledgeBaseArticle, provider: EmbeddingProviderName): boolean {
    return this.embeddingToggling.has(this.modelKey(article, provider));
  }

  /** Unlike toggleModel, there's no "un-embed" — clicking always (re)embeds via that provider,
   * targeted so every other provider's existing embeddings are left untouched (see
   * KnowledgeBaseService.PublishAsync's provider-given branch). Safe to click again on an
   * already-embedded badge to refresh it after an edit. */
  embedVia(article: KnowledgeBaseArticle, provider: EmbeddingProviderName, event: Event): void {
    event.stopPropagation();
    const key = this.modelKey(article, provider);
    if (this.embeddingToggling.has(key) || !this.canPublish(article.status)) {
      return;
    }

    const wasEmbedded = !!this.embeddedVia(article, provider);
    this.embeddingToggling.add(key);
    this.articles
      .publish(article.id, provider)
      .pipe(finalize(() => this.embeddingToggling.delete(key)))
      .subscribe({
        next: (updated) => {
          article.status = updated.status;
          article.chunkCount = updated.chunkCount;
          article.embeddingProvider = updated.embeddingProvider;
          article.embeddingModel = updated.embeddingModel;
          article.embeddedProviders = updated.embeddedProviders;
          this.notify.success(
            wasEmbedded
              ? `"${article.title}" re-embedded via ${provider}.`
              : `"${article.title}" embedded via ${provider}.`
          );
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  delete(article: KnowledgeBaseArticle, event: Event): void {
    event.stopPropagation();
    const data: ConfirmDialogData = {
      title: `Delete "${article.title}"?`,
      message: 'This cannot be undone. A Published article\'s embedded chunks are removed with it — the AI will no longer be able to cite it.',
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
          this.notify.success('Reindex complete — stale Published articles were re-embedded.');
          this.reload$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  private openForm(data: ArticleFormDialogData): void {
    this.dialog
      .open(ArticleFormDialogComponent, { data, width: '640px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }
}

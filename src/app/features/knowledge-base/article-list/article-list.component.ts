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
  KnowledgeBaseArticle,
  KnowledgeBaseArticleStatus,
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

  readonly displayedColumns = ['select', 'title', 'category', 'status', 'version', 'chunkCount', 'updatedAt', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusClass = knowledgeBaseStatusChipClass;
  readonly canPublish = canPublishArticle;
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

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly articles: KnowledgeBaseService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
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
        this.notify.success(`"${article.title}" published — chunked and embedded for AI retrieval.`);
        this.reload$.next();
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

/** KnowledgeBaseArticle.Status. Only Published articles are chunked/embedded and eligible for
 * RAG retrieval. Draft lets an article be written and reviewed without it being usable by the
 * AI yet. Archived exists in the domain for "remove from retrieval without deleting the
 * history," but no backend code path ever sets it yet — there is no archive action to offer. */
export enum KnowledgeBaseArticleStatus {
  Draft = 'Draft',
  Published = 'Published',
  Archived = 'Archived',
}

/** KnowledgeBaseArticle.SourceType — informational only, does not affect chunking/embedding. */
export enum KnowledgeBaseSourceType {
  Manual = 'Manual',
  Upload = 'Upload',
}

/** KnowledgeBaseArticleDto. */
export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  category: string | null;
  sourceType: KnowledgeBaseSourceType | string;
  content: string;
  status: KnowledgeBaseArticleStatus | string;
  version: number;
  approvedBy: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateKnowledgeBaseArticleRequest {
  title: string;
  category?: string | null;
  content: string;
  sourceType: string;
}

/** UpdateKnowledgeBaseArticleRequest. Editing content bumps the article's Version but does not
 * re-chunk/re-embed by itself — an already-Published article keeps serving its old chunks until
 * Publish or Reindex is called again, so an edit can be saved as a draft-in-progress without
 * affecting what the AI is currently grounded on. */
export interface UpdateKnowledgeBaseArticleRequest {
  title: string;
  category?: string | null;
  content: string;
}

export interface BulkPublishArticlesRequest {
  ids: string[];
}

/** BulkPublishArticlesResultDto. Ids that matched nothing or failed to re-embed (e.g. a transient
 * provider error) are reported rather than failing the whole call — the same partial-success shape
 * as BulkDeleteCustomersResultDto. */
export interface BulkPublishArticlesResult {
  requestedCount: number;
  publishedCount: number;
  notFoundIds: string[];
  failedIds: string[];
}

export function knowledgeBaseStatusChipClass(status: string): string {
  switch (status) {
    case KnowledgeBaseArticleStatus.Published:
      return 'status-chip status-chip--running';
    case KnowledgeBaseArticleStatus.Draft:
      return 'status-chip status-chip--draft';
    case KnowledgeBaseArticleStatus.Archived:
      return 'status-chip status-chip--stopped';
    default:
      return 'status-chip status-chip--draft';
  }
}

/**
 * Mirrors KnowledgeBaseService.PublishAsync: safe to call on a Draft article (first publish) or
 * again on an already-Published one to pick up an edited Content — the only status this doesn't
 * apply to is Archived, which nothing can currently un-archive back into rotation.
 */
export function canPublishArticle(status: string): boolean {
  return status !== KnowledgeBaseArticleStatus.Archived;
}

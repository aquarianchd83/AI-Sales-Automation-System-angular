/** KnowledgeBaseArticle.Status (backend KnowledgeArticleStatus). Six states since Phase 6, not
 * three. Only Published is eligible for retrieval; Approved means a human confirmed the content is
 * correct but it is not live yet, which is what lets a policy change be approved now and take
 * effect later. Deprecated and Archived both leave retrieval, but Deprecated stays visible to
 * admins and human agents - someone answering a question about last year's policy still needs to
 * be able to read it. */
export enum KnowledgeBaseArticleStatus {
  Draft = 'Draft',
  InReview = 'InReview',
  Approved = 'Approved',
  Published = 'Published',
  Deprecated = 'Deprecated',
  Archived = 'Archived',
}

/** KnowledgeBaseArticle.SourceType (backend KnowledgeSourceType). No longer informational: it
 * decides the article's authority rank, and so decides which article wins when two disagree. It
 * also selects the chunk sizing used when the article is indexed. */
export enum KnowledgeBaseSourceType {
  PlatformPolicy = 'PlatformPolicy',
  LegalCompliance = 'LegalCompliance',
  BillingRule = 'BillingRule',
  RefundCancellationPolicy = 'RefundCancellationPolicy',
  AiUsageCreditRule = 'AiUsageCreditRule',
  WhatsAppPolicy = 'WhatsAppPolicy',
  LeadDiscoveryRule = 'LeadDiscoveryRule',
  ProductDocumentation = 'ProductDocumentation',
  FeatureModuleDocumentation = 'FeatureModuleDocumentation',
  ApprovedFaq = 'ApprovedFaq',
  TroubleshootingGuide = 'TroubleshootingGuide',
  KnownIssue = 'KnownIssue',
  ReleaseChangeNote = 'ReleaseChangeNote',
  AdminConfiguredArticle = 'AdminConfiguredArticle',
  HistoricalDocumentation = 'HistoricalDocumentation',
}

/** The source types a TENANT may author. The rest are statements about the platform itself and are
 * reserved for a PlatformSuperAdmin - the API rejects them with a 400 explaining why (see
 * KnowledgeAuthority.GlobalOnly), so offering them in a tenant's dropdown would only produce an
 * error the user could not act on. All four of these cap at authority rank 30. */
export const TENANT_AUTHORABLE_SOURCE_TYPES: KnowledgeBaseSourceType[] = [
  KnowledgeBaseSourceType.AdminConfiguredArticle,
  KnowledgeBaseSourceType.ApprovedFaq,
  KnowledgeBaseSourceType.TroubleshootingGuide,
  KnowledgeBaseSourceType.HistoricalDocumentation,
];

/** "AdminConfiguredArticle" reads badly in a dropdown. */
export function sourceTypeDisplayName(sourceType: KnowledgeBaseSourceType | string): string {
  switch (sourceType) {
    case KnowledgeBaseSourceType.AdminConfiguredArticle:
      return 'General article';
    case KnowledgeBaseSourceType.ApprovedFaq:
      return 'FAQ';
    case KnowledgeBaseSourceType.TroubleshootingGuide:
      return 'Troubleshooting guide';
    case KnowledgeBaseSourceType.HistoricalDocumentation:
      return 'Historical / superseded';
    default:
      // Every remaining value is platform-only and will not normally reach a tenant's screen, so a
      // readable fallback beats fifteen more hand-written cases: "BillingRule" -> "Billing rule".
      return String(sourceType)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());
  }
}

/** AiModelProvider (backend Domain enum, serialized as its name). Which AI chat model an article
 * has been explicitly published to — see ArticleModelPublication. Deliberately excludes
 * "Simulated": that's a local-dev chat-client fallback, not a publishable target, and the backend
 * skips the per-model filter entirely when Simulated is the active provider. */
export enum AiModelProvider {
  OpenAI = 'OpenAI',
  Google = 'Google',
  Anthropic = 'Anthropic',
}

/** ArticleModelPublicationDto. One row per AI model this article is currently eligible for —
 * independent of KnowledgeBaseArticleStatus, which only tracks "has embedded chunks at all". An
 * article with no publications is chunked/embedded (once Published) but not yet retrievable by
 * any model. */
export interface ArticleModelPublication {
  provider: AiModelProvider | string;
  publishedAt: string;
  publishedBy: string | null;
}

/** EmbeddingProviderName — which IEmbeddingService a chunk's vector was produced by. A different
 * axis from AiModelProvider (chat model eligibility): Anthropic has no embeddings endpoint, so it
 * never appears here, and Simulated (needs no API key) is a real, valid embedding provider here
 * even though it's excluded from AiModelProvider. */
export enum EmbeddingProviderName {
  Simulated = 'Simulated',
  OpenAI = 'OpenAI',
  Google = 'Google',
}

/** ArticleEmbeddingProviderDto. One row per embedding provider this article's chunks have
 * actually been embedded for — independent of PublishedModels (which chat models may use the
 * article): an article can be published to the OpenAI chat model while its chunks were embedded
 * only by Simulated, e.g. if EmbeddingProvider was Simulated at the time it was last (re)embedded.
 */
export interface ArticleEmbeddingProvider {
  provider: EmbeddingProviderName | string;
  model: string;
  embeddedAt: string;
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
  publishedModels: ArticleModelPublication[];
  /** The embedding provider/model RetrieveRelevantChunksAsync's cosine similarity actually reads
   * right now — null for a Draft article that has never been embedded. See EmbeddedProviders for
   * the full multi-provider picture. */
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddedProviders: ArticleEmbeddingProvider[];
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
    case KnowledgeBaseArticleStatus.Approved:
    case KnowledgeBaseArticleStatus.InReview:
      return 'status-chip status-chip--pending';
    case KnowledgeBaseArticleStatus.Draft:
      return 'status-chip status-chip--draft';
    case KnowledgeBaseArticleStatus.Deprecated:
    case KnowledgeBaseArticleStatus.Archived:
      return 'status-chip status-chip--stopped';
    default:
      return 'status-chip status-chip--draft';
  }
}

/**
 * Mirrors KnowledgeBaseService.PublishAsync: safe to call on a Draft article (first publish) or
 * again on an already-Published one to pick up edited content.
 *
 * Deprecated joins Archived as a terminal state here. Both are deliberately out of retrieval, and
 * re-publishing one from the article list would undo that decision silently - bringing a policy
 * somebody retired back into the AI's mouth. Restoring one is a lifecycle action of its own.
 */
export function canPublishArticle(status: string): boolean {
  return (
    status !== KnowledgeBaseArticleStatus.Archived &&
    status !== KnowledgeBaseArticleStatus.Deprecated
  );
}

/** Consumer-facing brand name for a technical provider name — the backend/API only knows
 * "OpenAI"/"Google"/"Anthropic" (see AiModelProvider), but the product each one ships as is what
 * a non-technical user actually recognizes. */
export function aiModelDisplayName(provider: AiModelProvider | string): string {
  switch (provider) {
    case AiModelProvider.OpenAI:
      return 'ChatGPT';
    case AiModelProvider.Google:
      return 'Gemini';
    case AiModelProvider.Anthropic:
      return 'Claude';
    default:
      return provider;
  }
}

/** Fixed display order for the per-article model badges — same three values everywhere the UI
 * needs to enumerate them (article list, and any future publish dialog). */
export const AI_MODEL_PROVIDERS: AiModelProvider[] = [
  AiModelProvider.OpenAI,
  AiModelProvider.Google,
  AiModelProvider.Anthropic,
];

/** AvailableAiProvidersDto. Which chat models and embedding providers actually have a usable API
 * key configured in this deployment — the article-list UI uses this to hide publish/embed badges
 * for providers that could never do anything, rather than showing them disabled. "Simulated" needs
 * no key and is always present in embeddingProviders. */
export interface AvailableAiProviders {
  chatModels: string[];
  embeddingProviders: string[];
}

/** Fixed display order for the per-article embedding-provider badges — mirrors
 * IEmbeddingProviderCatalog.AllProviders (Simulated, OpenAI, Google; no Anthropic — it has no
 * embeddings endpoint). */
export const EMBEDDING_PROVIDERS: EmbeddingProviderName[] = [
  EmbeddingProviderName.Simulated,
  EmbeddingProviderName.OpenAI,
  EmbeddingProviderName.Google,
];

import { AnswerEvidence } from './product-answers.model';

/** An approved answer that is not in the next version, and why. Codes: TestData, NeedsRecheck, ReviewDue, OpenConflict. */
export interface HeldBack {
  questionId: string;
  question: string;
  code: 'TestData' | 'NeedsRecheck' | 'ReviewDue' | 'OpenConflict';
  reason: string;
}

export interface KnowledgeVersion {
  id: string;
  number: number;
  status: 'Current' | 'Superseded';
  publishedAt: string;
  publishedByEmail: string | null;
  itemCount: number;
  note: string | null;
  /** Set when this version was made by restoring an older one. */
  restoredFromNumber: number | null;
  /**
   * Whether customer chat can read this version: Indexing (being prepared), Live (chat reads it), Failed (published, but not prepared for chat — chat keeps
   * the last Live version) or Replaced (was Live; a newer version replaced it).
   */
  servingStatus: 'Indexing' | 'Live' | 'Failed' | 'Replaced';
  /** Why preparing it for chat failed, in a sentence. */
  servingError: string | null;
  /** UTC; when preparing it for chat last finished or failed. */
  servingIndexedAt: string | null;
}

/** What would be published now. */
export interface PublishPreview {
  ready: number;
  heldBack: HeldBack[];
  notYetApproved: number;
  /** Everything that would be published is already in the current version. */
  nothingNew: boolean;
  current: KnowledgeVersion | null;
}

export interface KnowledgeVersionsOverview {
  preview: PublishPreview;
  versions: KnowledgeVersion[];
  /** The platform administrator's switch for this tenant: ON, chat answers only from the published version; OFF, from the knowledge base articles. */
  chatUsesPublishedKnowledge: boolean;
  /** The version whose chunks chat can read now (the latest that went Live), or null if none has. */
  servingVersionNumber: number | null;
}

export interface KnowledgeItem {
  id: string;
  category: string;
  question: string;
  summary: string;
  detail: string | null;
  kind: string;
  confidence: string;
  isMaterialClaim: boolean;
  approvedAt: string;
  reviewDueAt: string | null;
  evidence: AnswerEvidence[];
}

export interface KnowledgeVersionDetail {
  version: KnowledgeVersion;
  items: KnowledgeItem[];
}

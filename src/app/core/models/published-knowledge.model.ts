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

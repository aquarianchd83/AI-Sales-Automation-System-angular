/** How strong the evidence is. Worked out by the application from verified quotations - never the AI's own confidence. */
export type KnowledgeConfidence = 'High' | 'Medium' | 'Low' | 'NoEvidence';

/** Kept separate from confidence: a High answer is still PendingVerification until the tenant acts. */
export type KnowledgeVerificationStatus =
  | 'PendingVerification'
  | 'VerifiedAndApproved'
  | 'CorrectionRequired'
  | 'Rejected'
  | 'InformationNotAvailable'
  | 'NotApplicable';

/** A quotation that was checked against the real source text. */
export interface AnswerEvidence {
  sourceId: string;
  sourceName: string;
  /** "Page 3", or the page address. */
  location: string;
  heading: string | null;
  excerpt: string;
}

export interface ConflictValue {
  value: string;
  sourceName: string;
  location: string;
  sentence: string;
}

/** Sources that give different values for the same fact. Both are shown; only the tenant decides. */
export interface KnowledgeConflict {
  id: string;
  fact: string;
  values: ConflictValue[];
  status: 'Open' | 'Resolved';
  /** What the tenant decided is right. Null while open. */
  chosenValue?: string | null;
}

export interface KnowledgeAnswer {
  id: string;
  version: number;
  summary: string | null;
  detail: string | null;
  kind: 'SourceExtracted' | 'AiInterpreted' | 'SuggestedLanguage' | 'TenantProvided';
  confidence: KnowledgeConfidence;
  status: KnowledgeVerificationStatus;
  /** What the sources do not settle. */
  limitation: string | null;
  /** The one short question that would close the gap. */
  clarifyingQuestion: string | null;
  /** Why the application gave this confidence. */
  reasons: string[];
  /** A price, guarantee, certification or outcome claim: needs the tenant's explicit approval. */
  isMaterialClaim: boolean;
  hasUnsupportedClaim: boolean;
  hasConflict: boolean;
  provider: string;
  model: string | null;
  isSimulated: boolean;
  generatedAt: string;
  evidence: AnswerEvidence[];
  conflicts: KnowledgeConflict[];
  /** When the tenant approved it. Kept when an approved answer is reopened. */
  approvedAt?: string | null;
  /** A source this answer was drawn from changed or was removed: the tenant should look at it again. */
  needsRevalidation?: boolean;
  revalidationReason?: string | null;
  /** When an approved price, guarantee or result must be confirmed again. */
  reviewDueAt?: string | null;
}

/** One entry in the audit trail of a question: who did what, when, and the text before and after. */
export interface AnswerRevision {
  id: string;
  kind: 'Drafted' | 'Approved' | 'Edited' | 'InformationProvided' | 'Rejected' | 'MarkedUnknown' | 'MarkedNotApplicable' | 'Reopened' | 'ConflictResolved' | 'SourceChanged';
  fromStatus: string | null;
  toStatus: string | null;
  fromText: string | null;
  toText: string | null;
  note: string | null;
  /** The tenant user who acted; null when the application did (a draft). */
  actorEmail: string | null;
  at: string;
}

/** Where the review stands: every question is in exactly one of these. */
export interface AnswerProgress {
  total: number;
  approved: number;
  waiting: number;
  needsInformation: number;
  rejected: number;
  unknown: number;
  notApplicable: number;
}

export interface KnowledgeQuestion {
  id: string;
  key: string | null;
  text: string;
  isStandard: boolean;
  category: string;
  sortOrder: number;
  answer: KnowledgeAnswer | null;
}

export interface FeatureBenefit {
  id: string;
  feature: string;
  problem: string | null;
  benefit: string | null;
  segment: string | null;
  confidence: KnowledgeConfidence;
  hasUnsupportedClaim: boolean;
  evidence: AnswerEvidence[];
  provider: string;
  isSimulated: boolean;
  generatedAt: string;
}

export interface DraftRun {
  id: string;
  status: 'Queued' | 'Running' | 'Completed' | 'Failed';
  total: number;
  done: number;
  drafted: number;
  noEvidence: number;
  skipped: number;
  failed: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface KnowledgeAnswersOverview {
  questions: KnowledgeQuestion[];
  features: FeatureBenefit[];
  run: DraftRun | null;
  /** Sources that have been read. Drafting needs at least one. */
  readySources: number;
  passages: number;
  /** How drafting runs on this platform: Off, Simulator or Api. */
  aiMode: 'Off' | 'Simulator' | 'Api';
  aiProvider: string;
  maxCustomQuestions: number;
  customQuestions: number;
  progress?: AnswerProgress | null;
}

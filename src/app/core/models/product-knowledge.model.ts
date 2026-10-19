/** Queued → Processing → Ready, or Failed (with a reason and a Retry). */
export type KnowledgeSourceStatus = 'Queued' | 'Processing' | 'Ready' | 'Failed';

/** A document the tenant uploaded, or their website. */
export interface KnowledgeSource {
  id: string;
  kind: 'Document' | 'Website';
  name: string;
  url: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  status: KnowledgeSourceStatus;
  errorCode: string | null;
  error: string | null;
  warnings: string[];
  attempts: number;
  version: number;
  passageCount: number;
  pageCount: number;
  qualityScore: number | null;
  usedAiReading: boolean;
  createdAt: string;
  processedAt: string | null;
  canRetry: boolean;
  canRescan: boolean;
  hasOriginal: boolean;
  hasText: boolean;
}

/** One page of a website, as the scan found it. */
export interface KnowledgeSourcePage {
  url: string;
  title: string | null;
  status: 'Read' | 'Duplicate' | 'Blocked' | 'Failed' | 'Skipped';
  httpStatus: number | null;
  error: string | null;
  depth: number;
  fetchedAt: string;
}

/** A passage of a source's text with where it came from - what later answers cite. */
export interface SourcePassage {
  id: string;
  order: number;
  pageNumber: number | null;
  url: string | null;
  heading: string | null;
  text: string;
  fromAiReading: boolean;
  extractedAt: string;
}

export interface KnowledgeSourceDetail {
  source: KnowledgeSource;
  pages: KnowledgeSourcePage[];
  passages: SourcePassage[];
  passageTotal: number;
}

export interface KnowledgeSourcesOverview {
  sources: KnowledgeSource[];
  maxSources: number;
  maxFileMb: number;
  supportedExtensions: string[];
  /** How scanned pages are read on this platform: Off, Simulator or Api. */
  scannedReading: 'Off' | 'Simulator' | 'Api';
  /** False until the platform's AWS Settings are filled in: uploads cannot be stored. */
  storageReady: boolean;
}

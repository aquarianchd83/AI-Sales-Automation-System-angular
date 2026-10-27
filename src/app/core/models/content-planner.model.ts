/** The AI Content Studio's planner: projects, topic ideas and scripts written from the tenant's verified facts. */

export type ContentProjectStatus = 'Draft' | 'Scripted' | 'Archived';
export type ContentTopicStatus = 'Suggested' | 'Chosen' | 'Rejected';
export type ContentVersionStatus = 'Draft' | 'InReview' | 'Approved' | 'Rejected';

/** Whether a scene's narration is backed by what the tenant has verified. Worked out by the application, never taken from the AI. */
export type ClaimStatus = 'NotChecked' | 'NoClaim' | 'Supported' | 'Unverified' | 'Unsupported';

export interface ProjectSummary {
  id: string;
  title: string;
  goal: string;
  language: string;
  status: ContentProjectStatus;
  topicCount: number;
  versionCount: number;
  chosenTopic: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ContentTopic {
  id: string;
  title: string;
  rationale: string | null;
  status: ContentTopicStatus;
  /** How many verified facts the idea rests on. */
  factCount: number;
  /** Predefined text from the platform's test mode, not written from the tenant's facts. */
  isSimulated: boolean;
  provider: string;
  createdAt: string;
}

export interface CitedFact {
  id: string;
  category: string;
  statement: string;
}

export interface ContentScene {
  id: string;
  order: number;
  narration: string;
  onScreenText: string | null;
  durationSeconds: number;
  visualHint: string | null;
  claimStatus: ClaimStatus;
  claimNote: string | null;
  editedByTenant: boolean;
  facts: CitedFact[];
  /** The picture chosen for the scene, or null while none is. */
  asset: AssetSummary | null;
}

export interface ScriptVersionSummary {
  id: string;
  number: number;
  topicTitle: string | null;
  status: ContentVersionStatus;
  isSimulated: boolean;
  sceneCount: number;
  totalSeconds: number;
  createdAt: string;
}

export interface ScriptVersion {
  id: string;
  projectId: string;
  number: number;
  topicId: string | null;
  topicTitle: string | null;
  status: ContentVersionStatus;
  targetSeconds: number;
  totalSeconds: number;
  notes: string | null;
  provider: string;
  model: string | null;
  promptVersion: string;
  isSimulated: boolean;
  activityId: string | null;
  createdAt: string;
  /** Scenes backed by a verified fact, or that need none. */
  supported: number;
  /** Scenes with a claim no verified fact backs: the ones to look at. */
  flagged: number;
  /** Scenes that have no picture chosen yet. */
  scenesWithoutPicture: number;
  scenes: ContentScene[];
}

export interface ProjectDetail {
  id: string;
  title: string;
  goal: string;
  language: string;
  status: ContentProjectStatus;
  /** How many verified, current facts the writer has to work from. Nothing can be written without any. */
  usableFacts: number;
  createdAt: string;
  updatedAt: string | null;
  topics: ContentTopic[];
  versions: ScriptVersionSummary[];
  currentVersion: ScriptVersion | null;
}

export interface CreateProjectBody {
  title: string;
  goal: string;
  language: string | null;
}

export interface UpdateSceneBody {
  narration: string;
  onScreenText: string | null;
  durationSeconds: number;
  visualHint: string | null;
}

export const PLANNER_LANGUAGES = ['English', 'Hindi', 'Hinglish', 'Marathi', 'Gujarati', 'Punjabi', 'Bengali', 'Tamil', 'Telugu', 'Kannada'];

export const SCRIPT_LENGTHS: { seconds: number; label: string }[] = [
  { seconds: 30, label: '30 seconds' },
  { seconds: 45, label: '45 seconds' },
  { seconds: 60, label: '1 minute' },
  { seconds: 90, label: '1½ minutes' },
  { seconds: 120, label: '2 minutes' },
];

export const CLAIM_LABELS: Record<ClaimStatus, string> = {
  NotChecked: 'Not checked',
  NoClaim: 'Needs no fact',
  Supported: 'Backed by a verified fact',
  Unverified: 'Not verified yet',
  Unsupported: 'No fact behind it',
};

// ----- pictures --------------------------------------------------------------------------------------------------------------------

export type AssetKind = 'Upload' | 'Screenshot' | 'Stock';

/** The part of a picture a scene shows: what it is, whose it is and under what terms. */
export interface AssetSummary {
  id: string;
  kind: AssetKind;
  /** "Your upload", "Your screenshot" or "Stock photo (Pexels)": always shown, so a stock photo is never passed off as the tenant's own. */
  kindLabel: string;
  name: string;
  licenseName: string;
  attribution: string | null;
  width: number | null;
  height: number | null;
}

export interface StudioAsset extends AssetSummary {
  description: string | null;
  tags: string[];
  contentType: string;
  sizeBytes: number;
  provider: string | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
  rightsConfirmed: boolean;
  personalDataChecked: boolean;
  usedInScenes: number;
  createdAt: string;
}

export interface AssetCandidate {
  asset: StudioAsset;
  /** 0-1: the share of the scene's picture-note words the picture shares. */
  score: number;
  reason: string;
}

export interface StockPhoto {
  providerAssetId: string;
  provider: string;
  previewUrl: string;
  pageUrl: string;
  photographer: string;
  width: number;
  height: number;
  description: string | null;
  licenseName: string;
  licenseUrl: string;
  attribution: string;
}

export interface AssetCandidates {
  query: string;
  own: AssetCandidate[];
  stock: StockPhoto[];
  /** False when stock search is not set up on the platform; `stockMessage` then says so. */
  stockAvailable: boolean;
  stockMessage: string | null;
}

export const MAX_IMAGE_MB = 10;

// ----- videos ----------------------------------------------------------------------------------------------------------------------

export type RenderStatus = 'Queued' | 'Preparing' | 'Rendering' | 'Succeeded' | 'Failed' | 'Cancelled';

export interface RenderJob {
  id: string;
  versionId: string;
  versionNumber: number;
  status: RenderStatus;
  /** 0-100. */
  progress: number;
  /** What is happening now, in a sentence. */
  stage: string | null;
  aspectRatio: string;
  voiceGender: string;
  /** "Shotstack", or "Simulator" when the platform is in test mode. */
  renderer: string;
  /** Made in the platform's test mode: no video exists. */
  isSimulated: boolean;
  /** The narration was spoken by a synthetic voice. */
  isAiVoice: boolean;
  hasVideo: boolean;
  videoBytes: number;
  videoSeconds: number;
  error: string | null;
  /** Scenes with a claim no verified fact backs when the video was started. */
  flaggedScenes: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Made from exactly the words and pictures that were approved. */
  isOfApprovedScript: boolean;
}

export const ASPECT_RATIOS: { value: string; label: string }[] = [
  { value: '16:9', label: 'Wide (16:9) - YouTube' },
  { value: '9:16', label: 'Tall (9:16) - Reels and Shorts' },
  { value: '1:1', label: 'Square (1:1)' },
];

export const ACTIVE_RENDER: RenderStatus[] = ['Queued', 'Preparing', 'Rendering'];

// ----- review and approval --------------------------------------------------------------------------------------------------------

export type ReviewAction = 'Submitted' | 'Withdrawn' | 'Approved' | 'Rejected' | 'Revised';

export interface ReviewEvent {
  id: string;
  action: ReviewAction;
  fromStatus: ContentVersionStatus | null;
  toStatus: ContentVersionStatus;
  actorEmail: string | null;
  comment: string | null;
  at: string;
}

export interface ReviewState {
  versionId: string;
  status: ContentVersionStatus;
  submittedAt: string | null;
  submittedByEmail: string | null;
  reviewedAt: string | null;
  reviewedByEmail: string | null;
  /** The reason it was rejected, or the approver's note. */
  reviewComment: string | null;
  /** Whether the person looking may approve or reject (an Admin always; a Sales Manager only if the tenant's policy allows). */
  canApprove: boolean;
  approvalIsAdminOnly: boolean;
  /** For an approved script: it still has exactly the words and pictures that were approved. */
  integrityOk: boolean;
  history: ReviewEvent[];
}

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  Submitted: 'Sent for approval',
  Withdrawn: 'Taken back',
  Approved: 'Approved',
  Rejected: 'Sent back',
  Revised: 'New draft started',
};

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

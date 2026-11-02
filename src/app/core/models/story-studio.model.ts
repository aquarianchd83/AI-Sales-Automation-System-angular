/** The cinematic story studio. Enums travel as numbers, matching the API's. */

export enum StoryCharacterOrigin {
  Uploaded = 0,
  Library = 1,
  ScriptGenerated = 2,
}

export enum StoryCharacterVisibility {
  Private = 0,
  Shared = 1,
}

export enum StoryProjectStatus {
  Draft = 0,
  ScriptApproved = 1,
  Generating = 2,
  InReview = 3,
  Approved = 4,
  Failed = 5,
  Cancelled = 6,
}

export enum SceneVideoProviderKind {
  Simulator = 0,
  Veo = 1,
  FlowImport = 2,
}

export const SCENE_VIDEO_PROVIDER_LABELS: Record<number, string> = {
  [SceneVideoProviderKind.Simulator]: 'Test clips (free)',
  [SceneVideoProviderKind.Veo]: 'Veo (automatic, paid)',
  [SceneVideoProviderKind.FlowImport]: 'Google Flow (you generate, we import)',
};

export const SCENE_VIDEO_PROVIDER_HINTS: Record<number, string> = {
  [SceneVideoProviderKind.Simulator]: 'Makes plain test clips so you can try the whole flow at no cost. Not a real video.',
  [SceneVideoProviderKind.Veo]: 'Generated for you through the Gemini API. Billed per second of video; regenerating a clip costs again.',
  [SceneVideoProviderKind.FlowImport]: 'We prepare one prompt per scene. You generate each clip in Google Flow and upload it. Flow has no public API.',
};

export const STORY_PROJECT_STATUS_LABELS: Record<number, string> = {
  [StoryProjectStatus.Draft]: 'Drafting script',
  [StoryProjectStatus.ScriptApproved]: 'Script approved',
  [StoryProjectStatus.Generating]: 'Making clips',
  [StoryProjectStatus.InReview]: 'In review',
  [StoryProjectStatus.Approved]: 'Approved',
  [StoryProjectStatus.Failed]: 'Failed',
  [StoryProjectStatus.Cancelled]: 'Cancelled',
};

export interface StoryCharacter {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  visualAttributes: string | null;
  voicePreferences: string | null;
  origin: StoryCharacterOrigin;
  visibility: StoryCharacterVisibility;
  isOwnedByTenant: boolean;
  rightsConfirmed: boolean;
  approvedReferenceId: string | null;
  referenceCount: number;
}

export interface CreateStoryCharacterBody {
  name: string;
  description: string | null;
  personality: string | null;
  visualAttributes: string | null;
  voicePreferences: string | null;
}

export interface StoryReference {
  id: string;
  version: number;
  status: number;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export interface StoryProject {
  id: string;
  title: string;
  topic: string;
  language: string;
  style: string | null;
  audience: string | null;
  moral: string | null;
  targetSeconds: number;
  status: StoryProjectStatus;
  videoProvider: SceneVideoProviderKind;
  budgetUsd: number | null;
  currentScriptVersionId: string | null;
  characterIds: string[];
  createdAt: string;
}

export interface CreateStoryProjectBody {
  title: string;
  topic: string;
  language: string;
  style: string | null;
  audience: string | null;
  moral: string | null;
  targetSeconds: number;
  videoProvider: SceneVideoProviderKind;
  budgetUsd: number | null;
  characterIds: string[];
}

export interface CinematicDialogue {
  speaker: string;
  text: string;
  expression: string;
  subtitleText: string;
  startMs: number;
  endMs: number;
}

export interface CinematicScene {
  index: number;
  targetSeconds: number;
  setting: string;
  camera: string;
  transition: string;
  soundEffects: string;
  continuityNotes: string;
  videoPrompt: string;
  dialogue: CinematicDialogue[];
}

export interface CinematicScript {
  title: string;
  description: string;
  hook: string;
  storySummary: string;
  language: string;
  punchline: string;
  characters: { name: string; visualDescription: string; voiceInstructions: string }[];
  scenes: CinematicScene[];
}

export interface StoryScriptVersion {
  id: string;
  number: number;
  status: number;
  source: string;
  contentHash: string;
  script: CinematicScript;
  isSimulated: boolean;
  createdAt: string;
}

export interface StoryCostEstimate {
  isKnown: boolean;
  clipUsd: number;
  clipSeconds: number;
  clips: number;
  provider: string;
  note: string;
}

export enum StorySceneStatus {
  Pending = 0,
  Queued = 1,
  Processing = 2,
  AwaitingImport = 3,
  Completed = 4,
  Failed = 5,
  Flagged = 6,
}

export const STORY_SCENE_STATUS_LABELS: Record<number, string> = {
  [StorySceneStatus.Pending]: 'Not started',
  [StorySceneStatus.Queued]: 'Waiting to start',
  [StorySceneStatus.Processing]: 'Being made',
  [StorySceneStatus.AwaitingImport]: 'Waiting for your Flow clip',
  [StorySceneStatus.Completed]: 'Clip ready',
  [StorySceneStatus.Failed]: 'Failed',
  [StorySceneStatus.Flagged]: 'Flagged - needs redoing',
};

/** One scene of an approved script with the state of its clip. */
export interface StoryClipScene {
  id: string;
  index: number;
  targetSeconds: number;
  status: StorySceneStatus;
  videoPrompt: string;
  dialogue: { speaker: string; text: string; startMs: number; endMs: number }[];
  actualMilliseconds: number | null;
  error: string | null;
  flagReason: string | null;
  costUsd: number;
}

export enum StoryJobStatus {
  Queued = 0,
  Processing = 1,
  Completed = 2,
  Failed = 3,
  Cancelled = 4,
}

/** One attempt at putting the clips together with subtitles. */
export interface StoryRender {
  id: string;
  status: StoryJobStatus;
  error: string | null;
  problems: string[];
  durationSeconds: number | null;
  hasVideo: boolean;
  createdAt: string;
}

export interface StoryScene {
  id: string;
  index: number;
  targetSeconds: number;
  status: number;
  videoPrompt: string;
  dialogue: { speaker: string; text: string; startMs: number; endMs: number }[];
}

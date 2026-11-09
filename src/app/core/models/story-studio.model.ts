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

/** Whether the platform lets tenants use a clip source right now, with the reason when not. */
export interface VideoSource {
  kind: SceneVideoProviderKind;
  available: boolean;
  reason: string | null;
}

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

/** One verified Business Fact, as the studio shows it. */
export interface StoryKnowledgeFact {
  id: string;
  category: string;
  subject: string | null;
  statement: string;
}

/** What the studio knows about the tenant's business: their verified Business Facts. */
export interface StoryKnowledge {
  isReady: boolean;
  verifiedFacts: number;
  facts: StoryKnowledgeFact[];
  message: string | null;
}

/** Where a tenant's request for a video stands. The API sends the name. */
export type StoryVideoRequestStatus = 'Raised' | 'ScriptReady' | 'VideoReady' | 'Rejected';

export const STORY_VIDEO_REQUEST_STATUS_LABELS: Record<StoryVideoRequestStatus, string> = {
  Raised: 'Requested',
  ScriptReady: 'Script written',
  VideoReady: 'Video ready',
  Rejected: 'Refunded',
};

/** One of the tenant's own requests (StoryVideoRequestDto). */
export interface StoryVideoRequest {
  id: string;
  projectId: string;
  title: string;
  status: StoryVideoRequestStatus;
  raisedAtUtc: string;
  scriptGeneratedAtUtc: string | null;
  videoUrl: string | null;
  videoReadyAtUtc: string | null;
  /** Why the platform team could not make the video (the credits were refunded). */
  rejectedReason: string | null;
  /** The credits taken when the request was raised, and how many of them went back. */
  prepaidCredits: number | null;
  creditsRefunded: number | null;
}

/** One request in the platform admin's list, across every tenant. */
export interface PlatformStoryVideoRequestRow {
  id: string;
  tenantId: string;
  tenantName: string;
  projectId: string;
  title: string;
  language: string;
  targetSeconds: number;
  status: StoryVideoRequestStatus;
  raisedAtUtc: string;
  scriptGeneratedAtUtc: string | null;
  videoReadyAtUtc: string | null;
  /** The credits the tenant prepaid, and how many of them were refunded. */
  prepaidCredits: number | null;
  creditsRefunded: number | null;
}

/** A request opened by the platform admin: the brief, the script so far, and the video if there is one. */
export interface PlatformStoryVideoRequestDetail extends PlatformStoryVideoRequestRow {
  topic: string;
  audience: string | null;
  callToAction: string | null;
  script: StoryScriptVersion | null;
  videoUrl: string | null;
  videoFileName: string | null;
  videoSource: string | null;
  /** False until a real video engine is switched on: the admin can only upload for now. */
  canGenerateVideo: boolean;
  rejectedReason: string | null;
}

/** A video idea: one real customer problem the business solves, and how. */
export interface StoryIdea {
  title: string;
  problem: string;
  solution: string;
  factIds: string[];
}

/** One spoken line checked against the verified facts. */
export interface ScriptClaim {
  scene: number;
  order: number;
  speaker: string;
  text: string;
  supported: boolean;
  isRisky: boolean;
  reason: string;
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
  factsUsed?: StoryKnowledgeFact[] | null;
  claims?: ScriptClaim[] | null;
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

export interface StoryUsageLine {
  category: string;
  jobs: number;
  failed: number;
  estimatedUsd: number;
  actualUsd: number;
}

export interface StoryUsage {
  lines: StoryUsageLine[];
  totalUsd: number;
  budgetUsd: number | null;
  wastedOnFailedUsd: number;
}

export interface GeneratedCharacter {
  character: StoryCharacter;
  preview: StoryReference;
}

export interface StoryCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface VoiceOverResult {
  scene: StoryClipScene;
  warnings: string[];
  provider: string;
  costUsd: number;
}

export enum StoryPlatform {
  YouTubeShorts = 0,
  FacebookReels = 1,
  InstagramReels = 2,
}

export const STORY_PLATFORM_LABELS: Record<number, string> = {
  [StoryPlatform.YouTubeShorts]: 'YouTube Shorts',
  [StoryPlatform.FacebookReels]: 'Facebook Reels',
  [StoryPlatform.InstagramReels]: 'Instagram Reels',
};

export interface PlatformPack {
  platform: StoryPlatform;
  title: string;
  description: string;
  hashtags: string[];
  rules: string[];
}

export interface StoryPublication {
  id: string;
  platform: StoryPlatform;
  url: string;
  publishedAtUtc: string;
}

export interface StoryPublishPack {
  renderId: string;
  platforms: PlatformPack[];
  published: StoryPublication[];
}

export interface StoryScene {
  id: string;
  index: number;
  targetSeconds: number;
  status: number;
  videoPrompt: string;
  dialogue: { speaker: string; text: string; startMs: number; endMs: number }[];
}

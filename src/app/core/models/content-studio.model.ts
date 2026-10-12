import { QuotaBalance, QuotaType } from './billing.model';
import { AppRole } from './user.model';

// Mirrors the API's AI Content Studio DTOs. Enums are plain ints on the wire (the API has no string-enum
// converter); the numbers match the backend enums exactly.

export enum StudioActivityKind {
  TopicIdeas = 0,
  Script = 1,
  SceneBreakdown = 2,
  VoiceOver = 3,
  StockAssetSearch = 4,
  ImageGeneration = 5,
  VideoRender = 6,
  Publish = 7,
  Other = 8,
}

export const STUDIO_ACTIVITY_KIND_LABELS: Record<StudioActivityKind, string> = {
  [StudioActivityKind.TopicIdeas]: 'Topic ideas',
  [StudioActivityKind.Script]: 'Script',
  [StudioActivityKind.SceneBreakdown]: 'Scene breakdown',
  [StudioActivityKind.VoiceOver]: 'Voice-over',
  [StudioActivityKind.StockAssetSearch]: 'Stock image search',
  [StudioActivityKind.ImageGeneration]: 'Generated illustration',
  [StudioActivityKind.VideoRender]: 'Video render',
  [StudioActivityKind.Publish]: 'Publish',
  [StudioActivityKind.Other]: 'Other',
};

export enum StudioActivityStatus {
  Charged = 0,
  Completed = 1,
  Refunded = 2,
  Blocked = 3,
}

export const STUDIO_ACTIVITY_STATUS_LABELS: Record<StudioActivityStatus, string> = {
  [StudioActivityStatus.Charged]: 'In progress',
  [StudioActivityStatus.Completed]: 'Done',
  [StudioActivityStatus.Refunded]: 'Refunded',
  [StudioActivityStatus.Blocked]: 'Not run (no credits)',
};

export enum StudioApprovalPolicy {
  AdminOnly = 0,
  AdminAndSalesManager = 1,
}

export const STUDIO_APPROVAL_POLICY_LABELS: Record<StudioApprovalPolicy, string> = {
  [StudioApprovalPolicy.AdminOnly]: 'Only admins',
  [StudioApprovalPolicy.AdminAndSalesManager]: 'Admins and sales managers',
};

export interface StudioActivity {
  id: string;
  kind: StudioActivityKind;
  kindLabel: string;
  status: StudioActivityStatus;
  description: string;
  quotaType: QuotaType;
  units: number;
  unitsRefunded: number;
  netUnits: number;
  balanceAfter: number;
  operationKey: string;
  referenceType: string | null;
  referenceId: string | null;
  provider: string | null;
  detail: string | null;
  actorUserId: string | null;
  actorName: string | null;
  requestedAtUtc: string;
  completedAtUtc: string | null;
}

export interface StudioActivityQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  kind?: StudioActivityKind | null;
  status?: StudioActivityStatus | null;
  quotaType?: QuotaType | null;
  fromUtc?: string | null;
  toUtc?: string | null;
}

export interface StudioUsageTotal {
  quotaType: QuotaType;
  charged: number;
  refunded: number;
  net: number;
  activities: number;
  blocked: number;
}

export interface StudioOverview {
  enabled: boolean;
  approvalPolicy: StudioApprovalPolicy;
  balances: QuotaBalance[];
  last30Days: StudioUsageTotal[];
}

export interface StudioSettings {
  approvalPolicy: StudioApprovalPolicy;
}

/** Who may fill in the questionnaire and manage business facts (an Admin alone verifies a fact). */
export const STUDIO_CONTENT_ROLES: string[] = [AppRole.Admin, AppRole.SalesManager];

// ---------------------------------------------------------------------------------------------------------------------------------------
// Questionnaire. A definition is plain JSON the platform admin authors; question types and operators travel as words.
// ---------------------------------------------------------------------------------------------------------------------------------------

export type QuestionType = 'ShortText' | 'LongText' | 'Number' | 'Boolean' | 'SingleChoice' | 'MultiChoice' | 'Structured';

export type ConditionOperator = 'Equal' | 'NotEqual' | 'In' | 'Contains' | 'Answered' | 'NotAnswered' | 'GreaterThan' | 'LessThan';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface QuestionField {
  key: string;
  label: string;
  type: QuestionType;
  required?: boolean;
}

export interface QuestionCondition {
  questionKey?: string | null;
  operator?: ConditionOperator | null;
  value?: unknown;
  all?: QuestionCondition[] | null;
  any?: QuestionCondition[] | null;
}

export interface QuestionDef {
  key: string;
  type: QuestionType;
  prompt: string;
  helpText?: string | null;
  required?: boolean;
  maxLength?: number | null;
  min?: number | null;
  max?: number | null;
  options?: QuestionOption[];
  fields?: QuestionField[];
  showWhen?: QuestionCondition | null;
  prefillFrom?: string | null;
  fact?: { category: string; template: string } | null;
}

export interface QuestionnaireDefinition {
  questions: QuestionDef[];
}

/** One answer: text, a number, yes/no, a list of option values, or an object of named fields. */
export type AnswerValue = string | number | boolean | string[] | Record<string, string | number | boolean | null>;

export type AnswerMap = Record<string, AnswerValue>;

export enum QuestionnaireResponseStatus {
  InProgress = 0,
  Completed = 1,
}

export interface QuestionnaireState {
  available: boolean;
  message: string | null;
  responseId: string | null;
  templateId: string | null;
  templateTitle: string | null;
  versionNumber: number;
  status: QuestionnaireResponseStatus;
  definition: QuestionnaireDefinition | null;
  answers: AnswerMap;
  visibleKeys: string[];
  newerVersionAvailable: boolean;
  completedAtUtc: string | null;
}

export interface QuestionnaireCompletion {
  state: QuestionnaireState;
  factsCreated: number;
  factsUpdated: number;
  factsRetired: number;
}

export interface QuestionnaireIssue {
  key: string;
  message: string;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Business facts
// ---------------------------------------------------------------------------------------------------------------------------------------

export enum BusinessFactStatus {
  Draft = 0,
  Verified = 1,
  Retired = 2,
}

export const BUSINESS_FACT_STATUS_LABELS: Record<BusinessFactStatus, string> = {
  [BusinessFactStatus.Draft]: 'Needs checking',
  [BusinessFactStatus.Verified]: 'Verified',
  [BusinessFactStatus.Retired]: 'Retired',
};

export enum BusinessFactSource {
  Questionnaire = 0,
  Manual = 1,
}

export interface BusinessFact {
  id: string;
  category: string;
  statement: string;
  sourceType: BusinessFactSource;
  sourceRef: string | null;
  status: BusinessFactStatus;
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAtUtc: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface BusinessFactQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BusinessFactStatus | null;
  category?: string | null;
  sourceType?: BusinessFactSource | null;
}

export interface BusinessFactSummary {
  draft: number;
  verified: number;
  retired: number;
  categories: string[];
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Platform: questionnaire templates
// ---------------------------------------------------------------------------------------------------------------------------------------

export enum QuestionnaireVersionStatus {
  Draft = 0,
  Published = 1,
}

export interface QuestionnaireTemplateSummary {
  id: string;
  key: string;
  title: string;
  description: string | null;
  industry: string | null;
  isActive: boolean;
  latestVersion: number;
  publishedVersion: number | null;
  updatedAt: string | null;
}

export interface QuestionnaireVersion {
  id: string;
  number: number;
  status: QuestionnaireVersionStatus;
  definitionJson: string;
  questionCount: number;
  publishedAtUtc: string | null;
}

export interface QuestionnaireTemplateDetail {
  template: QuestionnaireTemplateSummary;
  versions: QuestionnaireVersion[];
}

export interface CreateQuestionnaireTemplateRequest {
  key: string;
  title: string;
  description: string | null;
  industry: string | null;
  definitionJson: string;
}

export interface UpdateQuestionnaireTemplateRequest {
  title: string;
  description: string | null;
  industry: string | null;
  isActive: boolean;
}

export interface QuestionnaireValidation {
  valid: boolean;
  issues: QuestionnaireIssue[];
  questionCount: number;
}
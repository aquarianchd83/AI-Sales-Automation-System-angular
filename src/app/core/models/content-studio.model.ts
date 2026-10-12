import { QuotaBalance, QuotaType } from './billing.model';

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

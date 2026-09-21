/** ReportWindow. Every report covers the `days` ending now. */
export interface ReportWindow {
  days: number;
  from: string;
  to: string;
}

/** Windows offered by the report screens. The API accepts 1-365 and defaults to 30. */
export const REPORT_WINDOWS: { label: string; days: number }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
];

/** CampaignPerformanceRow. Rates are null when their denominator is zero. */
export interface CampaignPerformanceRow {
  campaignId: string;
  name: string | null;
  status: string | null;
  audience: number;
  contacted: number;
  messagesSent: number;
  delivered: number;
  read: number;
  failed: number;
  responded: number;
  optedOut: number;
  handedOff: number;
  deliveryRate: number | null;
  readRate: number | null;
  responseRate: number | null;
  optOutRate: number | null;
}

/** CampaignPerformanceReportDto. */
export interface CampaignPerformanceReport {
  window: ReportWindow;
  campaigns: CampaignPerformanceRow[];
  totals: CampaignPerformanceRow;
}

/** FunnelStageRow. */
export interface FunnelStageRow {
  stage: string | null;
  count: number;
  share: number | null;
}

/** LeadFunnelReportDto. `note` explains a caveat in the numbers when there is one. */
export interface LeadFunnelReport {
  window: ReportWindow;
  totalLeads: number;
  stages: FunnelStageRow[];
  byScoreBand: FunnelStageRow[];
  hotLeads: number;
  fromCampaigns: number;
  organic: number;
  qualifiedRate: number | null;
  wonRate: number | null;
  lostRate: number | null;
  note: string | null;
}

/** AgentPerformanceRow — a human sales agent (the AI agent has its own report). */
export interface HumanAgentRow {
  userId: string;
  name: string | null;
  leadsAssigned: number;
  leadsWon: number;
  leadsLost: number;
  winRate: number | null;
  handoffsAssigned: number;
  handoffsResolved: number;
  handoffsOpen: number;
  averageResolutionMinutes: number | null;
}

/** HumanAgentPerformanceReportDto. */
export interface HumanAgentPerformanceReport {
  window: ReportWindow;
  agents: HumanAgentRow[];
}

export interface AiModelRow {
  model: string | null;
  interactions: number;
  averageConfidence: number | null;
  averageLatencyMs: number | null;
}

export interface AiDailyRow {
  date: string;
  interactions: number;
  escalated: number;
}

/** AiPerformanceReportDto. */
export interface AiPerformanceReport {
  window: ReportWindow;
  interactions: number;
  replied: number;
  escalated: number;
  noActionNeeded: number;
  escalationRate: number | null;
  averageConfidence: number | null;
  averageLatencyMs: number | null;
  promptTokens: number;
  completionTokens: number;
  buyingIntentReported: number;
  humanRequestReported: number;
  optOutReported: number;
  byModel: AiModelRow[];
  daily: AiDailyRow[];
}

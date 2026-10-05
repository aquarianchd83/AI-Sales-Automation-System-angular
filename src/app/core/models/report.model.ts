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

/** Periods offered by the Revenue report, in calendar months (this month included). The API takes 1-24. */
export const REVENUE_PERIODS: { label: string; months: number }[] = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
];

/** RevenueTrendPointDto — one bar of the trend chart; `start` is the day (1-month view) or month. */
export interface RevenueTrendPoint {
  start: string;
  revenue: number;
  sales: number;
}

/** PackageRevenueRowDto. `rank` is by sales count (1 = most popular), 0 when the package sold nothing. */
export interface PackageRevenueRow {
  packageId: string;
  name: string;
  isActive: boolean;
  price: number;
  salesCount: number;
  revenue: number;
  salesSharePercent: number | null;
  revenueSharePercent: number | null;
  uniqueCustomers: number;
  /** The tenant's own expected sales per month times the months in the period. */
  targetSales: number;
  rank: number;
}

/** RevenueReportDto. Percent fields are null when their denominator is zero. */
export interface RevenueReport {
  months: number;
  granularity: 'Day' | 'Month';
  from: string;
  to: string;
  totalRevenue: number;
  salesCount: number;
  averageSale: number;
  uniqueCustomers: number;
  previousRevenue: number;
  previousSalesCount: number;
  revenueChangePercent: number | null;
  expectedRevenue: number;
  targetAchievedPercent: number | null;
  mostPopularPackage: string | null;
  topRevenuePackage: string | null;
  trend: RevenueTrendPoint[];
  packages: PackageRevenueRow[];
}

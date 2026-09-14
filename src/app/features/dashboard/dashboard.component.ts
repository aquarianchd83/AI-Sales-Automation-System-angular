import { Component, OnInit } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Subscription as BillingSubscription } from '../../core/models/billing.model';
import {
  Campaign,
  CampaignStatus,
  campaignStatusChipClass,
} from '../../core/models/campaign.model';
import {
  Conversation,
  ConversationStatus,
  conversationStatusChipClass,
} from '../../core/models/conversation.model';
import { Handoff, HandoffStatus } from '../../core/models/handoff.model';
import {
  LEAD_STAGE_ORDER,
  Lead,
  LeadScoreBand,
  LeadStage,
  leadScoreChipClass,
  leadStageChipClass,
} from '../../core/models/lead.model';
import { PagedResult } from '../../core/models/paged-result.model';
import {
  TenantMessageUsage,
  TenantWhatsAppConfig,
} from '../../core/models/tenant-settings.model';
import { TENANT_ADMIN_ROLES, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { CampaignService } from '../../core/services/campaign.service';
import { ConversationService } from '../../core/services/conversation.service';
import { CustomerService } from '../../core/services/customer.service';
import { HandoffService } from '../../core/services/handoff.service';
import { KnowledgeBaseService } from '../../core/services/knowledge-base.service';
import { LeadService } from '../../core/services/lead.service';
import { MessageTemplateService } from '../../core/services/message-template.service';
import { TenantSettingsService } from '../../core/services/tenant-settings.service';

type Tone = 'teal' | 'indigo' | 'amber' | 'violet' | 'green' | 'rose' | 'blue' | 'grey';

interface Kpi {
  label: string;
  icon: string;
  tone: Tone;
  route: string;
  value: number | null;
  hint?: string;
}

interface Bar {
  label: string;
  count: number;
  /** Width relative to the largest bar (pipeline) or share of the whole (temperature). */
  percent: number;
  tone: Tone;
}

interface Alert {
  icon: string;
  tone: 'warn' | 'info';
  text: string;
  action: string;
  route: string;
}

interface ChecklistItem {
  label: string;
  hint: string;
  icon: string;
  done: boolean;
  route: string;
}

interface Overview {
  customers: number | null;
  openConversations: number | null;
  escalatedConversations: number | null;
  recentConversations: PagedResult<Conversation> | null;
  pendingHandoffs: PagedResult<Handoff> | null;
  campaigns: PagedResult<Campaign> | null;
  templates: number | null;
  articles: number | null;
}

interface Pipeline {
  topLeads: PagedResult<Lead> | null;
  stages: (number | null)[];
  bands: (number | null)[];
}

interface Account {
  usage: TenantMessageUsage | null;
  whatsApp: TenantWhatsAppConfig | null;
  subscription: BillingSubscription | null;
}

const STAGE_TONES: Record<string, Tone> = {
  [LeadStage.New]: 'grey',
  [LeadStage.Qualifying]: 'blue',
  [LeadStage.Qualified]: 'teal',
  [LeadStage.Negotiation]: 'amber',
  [LeadStage.Won]: 'green',
  [LeadStage.Lost]: 'rose',
};

const BAND_ORDER: LeadScoreBand[] = [LeadScoreBand.Hot, LeadScoreBand.Warm, LeadScoreBand.Cold];

const BAND_TONES: Record<string, Tone> = {
  [LeadScoreBand.Hot]: 'rose',
  [LeadScoreBand.Warm]: 'amber',
  [LeadScoreBand.Cold]: 'blue',
};

/** The campaign list endpoint has no status filter, so running/scheduled counts are tallied from
 * one page of the most recent campaigns — the API's PagedRequest caps a page at 100. */
const CAMPAIGN_SAMPLE_SIZE = 100;

/** Quota share at which the dashboard starts warning about message usage. */
const QUOTA_WARNING_PERCENT = 80;

/**
 * The tenant home screen. There is no dashboard endpoint for a tenant, so every widget is built
 * from the ordinary list endpoints — a one-row page is enough to read totalCount from the paged
 * envelope. Requests are split into three independent groups (overview, lead pipeline, account)
 * so a slow or failing group doesn't hold the rest of the page hostage; every individual call
 * degrades to null rather than failing its group.
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  readonly currentUser$: Observable<User | null> = this.auth.currentUser$;
  /** Subscription, usage and WhatsApp status endpoints are tenant-admin only. */
  readonly isTenantAdmin = this.auth.hasAnyRole(TENANT_ADMIN_ROLES);

  readonly greeting = greetingFor(new Date());
  readonly today = new Date();

  readonly campaignStatusChipClass = campaignStatusChipClass;
  readonly conversationStatusChipClass = conversationStatusChipClass;
  readonly leadStageChipClass = leadStageChipClass;
  readonly leadScoreChipClass = leadScoreChipClass;

  loadingOverview = true;
  loadingPipeline = true;
  loadingAccount = this.isTenantAdmin;

  kpis: Kpi[] = [];
  alerts: Alert[] = [];
  checklist: ChecklistItem[] = [];

  recentConversations: Conversation[] = [];
  pendingHandoffs: Handoff[] = [];
  recentCampaigns: Campaign[] = [];
  topLeads: Lead[] = [];

  stageBars: Bar[] = [];
  bandBars: Bar[] = [];
  bandTotal = 0;

  account: Account | null = null;
  /** null when the plan is unlimited (no plan yet) or usage couldn't be read. */
  quotaPercent: number | null = null;

  private overview: Overview | null = null;
  private pipeline: Pipeline | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly customers: CustomerService,
    private readonly conversations: ConversationService,
    private readonly handoffs: HandoffService,
    private readonly leads: LeadService,
    private readonly campaigns: CampaignService,
    private readonly templates: MessageTemplateService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly tenantSettings: TenantSettingsService,
    private readonly billing: BillingService
  ) {}

  ngOnInit(): void {
    this.loadOverview();
    this.loadPipeline();
    if (this.isTenantAdmin) {
      this.loadAccount();
    }
  }

  firstName(user: User | null): string {
    return user?.fullName?.trim().split(/\s+/)[0] || 'there';
  }

  initials(name: string | null | undefined): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '#';
  }

  /** "5m ago" style. The API serializes some timestamps without a zone designator even though
   * they are stored as UTC, so a bare value is read as UTC rather than browser-local time. */
  timeAgo(value: string | null): string {
    if (!value) {
      return '—';
    }
    const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(value);
    const date = new Date(hasZone ? value : `${value}Z`);
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  get checklistDone(): number {
    return this.checklist.filter((item) => item.done).length;
  }

  private loadOverview(): void {
    const page1 = { page: 1, pageSize: 1 };
    forkJoin({
      customers: this.total(this.customers.getPaged(page1)),
      openConversations: this.total(this.conversations.getPaged(page1, ConversationStatus.Open)),
      escalatedConversations: this.total(
        this.conversations.getPaged(page1, ConversationStatus.Escalated)
      ),
      recentConversations: this.safe(this.conversations.getPaged({ page: 1, pageSize: 5 })),
      pendingHandoffs: this.safe(
        this.handoffs.getPaged({ page: 1, pageSize: 5 }, HandoffStatus.Pending)
      ),
      campaigns: this.safe(this.campaigns.getPaged({ page: 1, pageSize: CAMPAIGN_SAMPLE_SIZE })),
      templates: this.total(this.templates.getPaged(page1)),
      articles: this.total(this.knowledgeBase.getPaged(page1)),
    }).subscribe((overview) => {
      this.overview = overview;
      this.recentConversations = overview.recentConversations?.items ?? [];
      this.pendingHandoffs = overview.pendingHandoffs?.items ?? [];
      this.recentCampaigns = (overview.campaigns?.items ?? []).slice(0, 5);
      this.loadingOverview = false;
      this.rebuild();
    });
  }

  private loadPipeline(): void {
    const page1 = { page: 1, pageSize: 1 };
    forkJoin({
      topLeads: this.safe(this.leads.getPaged({ page: 1, pageSize: 5 })),
      stages: forkJoin(
        LEAD_STAGE_ORDER.map((stage) => this.total(this.leads.getPaged(page1, stage)))
      ),
      bands: forkJoin(
        BAND_ORDER.map((band) => this.total(this.leads.getPaged(page1, undefined, band)))
      ),
    }).subscribe((pipeline) => {
      this.pipeline = pipeline;
      this.topLeads = pipeline.topLeads?.items ?? [];

      const stageCounts = pipeline.stages.map((n) => n ?? 0);
      const maxStage = Math.max(1, ...stageCounts);
      this.stageBars = LEAD_STAGE_ORDER.map((stage, i) => ({
        label: stage,
        count: stageCounts[i],
        percent: (stageCounts[i] / maxStage) * 100,
        tone: STAGE_TONES[stage],
      }));

      const bandCounts = pipeline.bands.map((n) => n ?? 0);
      this.bandTotal = bandCounts.reduce((sum, n) => sum + n, 0);
      this.bandBars = BAND_ORDER.map((band, i) => ({
        label: band,
        count: bandCounts[i],
        percent: this.bandTotal ? (bandCounts[i] / this.bandTotal) * 100 : 0,
        tone: BAND_TONES[band],
      }));

      this.loadingPipeline = false;
      this.rebuild();
    });
  }

  private loadAccount(): void {
    forkJoin({
      usage: this.safe(this.tenantSettings.getUsage()),
      whatsApp: this.safe(this.tenantSettings.getWhatsAppConfig()),
      subscription: this.safe(this.billing.getSubscription()),
    }).subscribe((account) => {
      this.account = account;
      const usage = account.usage;
      this.quotaPercent =
        usage && usage.maxMessagesPerMonth
          ? Math.min(100, (usage.messagesSentThisMonth / usage.maxMessagesPerMonth) * 100)
          : null;
      this.loadingAccount = false;
      this.rebuild();
    });
  }

  /** Recomputes everything derived from more than one request group, as each group lands. */
  private rebuild(): void {
    const o = this.overview;
    const p = this.pipeline;
    const stage = (s: LeadStage) => p?.stages[LEAD_STAGE_ORDER.indexOf(s)] ?? null;

    const totalLeads = p?.topLeads?.totalCount ?? null;
    const won = stage(LeadStage.Won);
    const lost = stage(LeadStage.Lost);
    const activeLeads =
      totalLeads !== null && won !== null && lost !== null ? totalLeads - won - lost : null;
    const closed = (won ?? 0) + (lost ?? 0);
    const hot = p?.bands[BAND_ORDER.indexOf(LeadScoreBand.Hot)] ?? null;

    const campaignItems = o?.campaigns?.items ?? [];
    const countStatus = (s: CampaignStatus) => campaignItems.filter((c) => c.status === s).length;

    this.kpis = [
      {
        label: 'Customers',
        icon: 'groups',
        tone: 'teal',
        route: '/customers',
        value: o?.customers ?? null,
      },
      {
        label: 'Open conversations',
        icon: 'forum',
        tone: 'indigo',
        route: '/conversations',
        value: o?.openConversations ?? null,
        hint: o?.escalatedConversations ? `${o.escalatedConversations} escalated` : undefined,
      },
      {
        label: 'Waiting for an agent',
        icon: 'support_agent',
        tone: 'amber',
        route: '/handoffs',
        value: o?.pendingHandoffs?.totalCount ?? null,
      },
      {
        label: 'Active leads',
        icon: 'insights',
        tone: 'violet',
        route: '/leads',
        value: activeLeads,
        hint: hot ? `${hot} hot` : undefined,
      },
      {
        label: 'Deals won',
        icon: 'emoji_events',
        tone: 'green',
        route: '/leads',
        value: won,
        hint: closed ? `${Math.round(((won ?? 0) / closed) * 100)}% win rate` : undefined,
      },
      {
        label: 'Campaigns',
        icon: 'campaign',
        tone: 'rose',
        route: '/campaigns',
        value: o?.campaigns?.totalCount ?? null,
        hint: o?.campaigns
          ? `${countStatus(CampaignStatus.Running)} running · ${countStatus(CampaignStatus.Scheduled)} scheduled`
          : undefined,
      },
    ];

    this.alerts = this.buildAlerts();
    this.checklist = this.buildChecklist();
  }

  private buildAlerts(): Alert[] {
    const alerts: Alert[] = [];
    const pending = this.overview?.pendingHandoffs?.totalCount ?? 0;
    if (pending > 0) {
      alerts.push({
        icon: 'support_agent',
        tone: 'warn',
        text: `${pending} ${pending === 1 ? 'customer is' : 'customers are'} waiting for a human agent.`,
        action: 'Open handoffs',
        route: '/handoffs',
      });
    }
    if (this.account) {
      if (!this.account.whatsApp?.isConnected) {
        alerts.push({
          icon: 'link_off',
          tone: 'warn',
          text: 'WhatsApp is not connected yet — campaigns and replies cannot be sent.',
          action: 'View status',
          route: '/tenant-settings',
        });
      }
      if (this.quotaPercent !== null && this.quotaPercent >= QUOTA_WARNING_PERCENT) {
        alerts.push({
          icon: 'data_usage',
          tone: this.quotaPercent >= 100 ? 'warn' : 'info',
          text: `You have used ${Math.round(this.quotaPercent)}% of this month's message quota.`,
          action: 'See plans',
          route: '/billing',
        });
      }
    }
    return alerts;
  }

  /** Onboarding steps for a new workspace; the card hides itself once every step is done, and
   * stays hidden until the overview group has loaded so it doesn't flash for established tenants. */
  private buildChecklist(): ChecklistItem[] {
    const o = this.overview;
    if (!o) {
      return [];
    }
    const items: ChecklistItem[] = [];
    if (this.isTenantAdmin) {
      if (!this.account) {
        return [];
      }
      items.push({
        label: 'Connect WhatsApp',
        hint: 'Your platform administrator links your WhatsApp Business number.',
        icon: 'cloud_sync',
        done: !!this.account.whatsApp?.isConnected,
        route: '/tenant-settings',
      });
    }
    items.push(
      {
        label: 'Add your customers',
        hint: 'Import a CSV or add contacts one by one.',
        icon: 'group_add',
        done: (o.customers ?? 0) > 0,
        route: '/customers',
      },
      {
        label: 'Create a message template',
        hint: 'Approved templates let you message customers any time.',
        icon: 'forum',
        done: (o.templates ?? 0) > 0,
        route: '/message-templates',
      },
      {
        label: 'Teach the AI about your business',
        hint: 'Knowledge base articles ground the AI’s replies.',
        icon: 'menu_book',
        done: (o.articles ?? 0) > 0,
        route: '/knowledge-base',
      },
      {
        label: 'Launch your first campaign',
        hint: 'Reach opted-in customers with a message sequence.',
        icon: 'rocket_launch',
        done: (o.campaigns?.items ?? []).some((c) => c.status !== CampaignStatus.Draft),
        route: '/campaigns',
      }
    );
    return items.some((item) => !item.done) ? items : [];
  }

  private total(source: Observable<{ totalCount: number }>): Observable<number | null> {
    return source.pipe(
      map((page) => page.totalCount),
      catchError(() => of(null))
    );
  }

  private safe<T>(source: Observable<T>): Observable<T | null> {
    return source.pipe(catchError(() => of(null)));
  }
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

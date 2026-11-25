import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subject, of, timer } from 'rxjs';
import { filter, finalize, map, shareReplay, switchMap, takeUntil } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { LeadFollowUpService } from '../../core/services/lead-follow-up.service';
import { AppRole, REPORT_ROLES, User } from '../../core/models/user.model';
import { Announcement, PLATFORM_ADMIN_ROLES, PlatformNotification, platformNotificationRoute } from '../../core/models/platform.model';
import { AccountRecoveryService } from '../../core/services/account-recovery.service';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { TenantNotification, isUrgentNotification, tenantNotificationActionLabel, tenantNotificationRoute } from '../../core/models/billing.model';
import { BillingService } from '../../core/services/billing.service';
import { STUDIO_CONTENT_ROLES } from '../../core/models/content-studio.model';
import { ContentStudioService } from '../../core/services/content-studio.service';
import { EntitlementsService } from '../../core/services/entitlements.service';
import { EntitlementsStore } from '../../core/services/entitlements.store';
import { PlatformTicketService } from '../../core/services/platform-ticket.service';
import { PlatformWalletService } from '../../core/services/platform-wallet.service';
import { PlatformWalletTopUpDialogComponent } from '../../shared/components/platform-wallet-top-up-dialog/platform-wallet-top-up-dialog.component';
import { FeatureTrial, PlatformFeature, trialLeftLabel, trialUsedUpLabel } from '../../core/models/wallet.model';
import { featurePreviewUrl } from '../../core/models/feature-preview.model';
import { NotificationsChangedService } from '../../core/services/notifications-changed.service';
import { NotificationHubService } from '../../core/services/notification-hub.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { OnboardingStatus, OnboardingStep, currentStep } from '../../core/models/onboarding.model';
import { OnboardingService } from '../../core/services/onboarding.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
  /** Highlight only on an exact route match - for a parent route whose child has its own nav entry. */
  exact?: boolean;
  /** Hidden while this returns false - for an entry whose screen only exists once the platform switches its module on. */
  visible?: () => boolean;
  /** Other url prefixes that also mean this entry is the current one - for an entry that opens a page holding several routes. */
  matches?: string[];
  /**
   * Locked for a tenant whose plan does not include this feature: still listed, dimmed with a lock and a Premium chip, and it opens the feature's
   * preview page instead of the screen. A function for an entry that opens on whichever of several features is in the plan - it returns the
   * feature that locks the entry, or undefined when the entry is open.
   */
  feature?: PlatformFeature | (() => PlatformFeature | undefined);
  /** Features whose free uses this entry's chip shows, when `feature` alone does not name them (an entry behind several features, or one with no lock). */
  trialFeatures?: PlatformFeature[];
  /** Where the entry goes when it depends on the plan, read each time instead of `route`. */
  link?: () => string;
  /** A plan limit that is not a feature (EntitlementsStore.quotaOf), shown in the same chip: "4 left", then "Used up". */
  quotaKey?: string;
  /** Shows "N to approve" beside the entry while the AI has follow-up suggestions waiting for a person. */
  approveChip?: boolean;
}

/** A labelled group of nav items. `label` null renders the items with no heading. */
interface NavSection {
  label: string | null;
  items: NavItem[];
}

const TENANT_ADMIN_ONLY = [AppRole.Admin];

/** Which feature a screen belongs to, by the start of its address - for the free-trial bar above it. */
const FEATURE_ROUTES: [string, PlatformFeature][] = [
  ['/lead-discovery', 'LeadDiscovery'],
  ['/product-knowledge', 'ProductKnowledge'],
  ['/content-studio', 'ContentStudio'],
  ['/conversations', 'AiConversations'],
  ['/message-templates', 'WhatsAppMessaging'],
  ['/campaigns', 'Campaigns'],
];

/** localStorage key for the set of announcement ids this browser has dismissed — a per-viewer
 * convenience (see TokenStorageService's own doc comment on why localStorage is already this
 * app's storage of choice), not synced anywhere, so dismissing on one device/browser doesn't
 * dismiss it on another. */
const DISMISSED_ANNOUNCEMENTS_KEY = 'wsa.dismissedAnnouncementIds';

/** localStorage key for the nav groups this browser has collapsed - a per-viewer convenience, like the dismissed announcements. */
const COLLAPSED_NAV_KEY = 'wsa.collapsedNavSections';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit, OnDestroy {
  /**
   * The ordinary tenant-scoped nav — shown only to a tenant user (Admin/SalesManager/SalesAgent/
   * tenant SuperAdmin), never to a PlatformSuperAdmin. A PlatformSuperAdmin belongs to no tenant,
   * so every one of these screens (built for one tenant's own admin/agents to manage their own
   * data) would be empty or meaningless for that role — see isPlatformSuperAdmin below and
   * AppRole.PlatformSuperAdmin's own doc comment. The two nav experiences are deliberately kept
   * separate rather than merged into one role-filtered list.
   *
   * Grouped by what the user is doing (talking to customers, managing the pipeline, preparing
   * content, reading results, setting up the business, managing the team, billing) so the links scan as short lists.
   */
  readonly tenantNavSections: NavSection[] = [
    {
      label: null,
      items: [
        { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', roles: [] },
      ],
    },
    {
      // Finding people and reaching out to them: discover, the customers they become, the messages, the campaigns that send them.
      label: 'Outreach',
      items: [
        {
          label: 'Lead Discovery',
          icon: 'travel_explore',
          // An Admin lands straight on Lead Discovery History (Admin-only route); anyone else lands on
          // Discovered Leads, since History would 403 them - see the lead-discovery route guard.
          route: this.auth.hasAnyRole(TENANT_ADMIN_ONLY) ? '/lead-discovery/history' : '/lead-discovery',
          roles: [],
          feature: 'LeadDiscovery',
        },
        // Tags is opened from the Customers page, so it stays under this entry.
        { label: 'Customers', icon: 'groups', route: '/customers', roles: [], matches: ['/tags'], quotaKey: 'Customers' },
        { label: 'Message Templates', icon: 'text_snippet', route: '/message-templates', roles: [], feature: 'WhatsAppMessaging' },
        { label: 'Campaigns', icon: 'campaign', route: '/campaigns', roles: [], feature: 'Campaigns' },
        // One entry for everything the AI knows; its screens are listed on the page itself (KnowledgeHubComponent).
        {
          label: 'Knowledge',
          icon: 'psychology',
          // An Admin lands on Product Sources; a Sales Manager only has the studio screens, so lands on the questionnaire - and so does an Admin
          // whose plan has the studio but not product knowledge.
          route: this.auth.hasAnyRole(TENANT_ADMIN_ONLY) ? '/product-knowledge/sources' : '/content-studio/questionnaire',
          link: () => (this.canOpenProductKnowledge() || !this.canOpenStudio() ? '/product-knowledge/sources' : '/content-studio/questionnaire'),
          roles: STUDIO_CONTENT_ROLES,
          // An Admin always has a Knowledge screen to open or to preview; a Sales Manager only has the studio ones, once the platform switches it on.
          visible: () => this.auth.hasAnyRole(TENANT_ADMIN_ONLY) || this.studioEnabled,
          // Open while either feature behind it is; locked on the one this user would land on.
          feature: () =>
            this.canOpenProductKnowledge() || this.canOpenStudio()
              ? undefined
              : this.auth.hasAnyRole(TENANT_ADMIN_ONLY)
              ? 'ProductKnowledge'
              : 'ContentStudio',
          matches: ['/product-knowledge', '/content-studio/questionnaire', '/content-studio/facts', '/content-studio/readiness'],
          trialFeatures: ['ProductKnowledge', 'ContentStudio'],
        },
      ],
    },
    {
      label: 'Engage',
      items: [
        { label: 'Inbox', icon: 'inbox', route: '/conversations', roles: [], trialFeatures: ['AiConversations'] },
        { label: 'Handoffs', icon: 'support_agent', route: '/handoffs', roles: [] },
        { label: 'Leads', icon: 'insights', route: '/leads', roles: [] },
        { label: 'Follow-ups', icon: 'event_repeat', route: '/follow-ups', roles: [], approveChip: true },
        { label: 'Demos Scheduled', icon: 'event_available', route: '/bookings', roles: [] },
      ],
    },
    {
      label: 'Extra',
      items: [
        { label: 'Packages', icon: 'inventory_2', route: '/packages', roles: [] },
        { label: 'Media Library', icon: 'perm_media', route: '/media', roles: [] },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { label: 'Social Ads', icon: 'public', route: '/social-ads', roles: TENANT_ADMIN_ONLY },
        {
          label: 'Story Studio',
          icon: 'movie_creation',
          route: '/content-studio/stories',
          roles: STUDIO_CONTENT_ROLES,
          visible: () => this.studioEnabled,
          feature: 'ContentStudio',
        },
        {
          label: 'Charges & Activity',
          icon: 'receipt_long',
          route: '/content-studio',
          roles: TENANT_ADMIN_ONLY,
          exact: true,
          visible: () => this.studioEnabled,
          feature: 'ContentStudio',
        },
      ],
    },
    {
      label: 'Billing',
      items: [
        { label: 'Membership', icon: 'payments', route: '/billing', roles: TENANT_ADMIN_ONLY, exact: true },
        { label: 'Usage & Credits', icon: 'data_usage', route: '/billing/wallet', roles: TENANT_ADMIN_ONLY, matches: ['/billing/credit-usage'] },
        { label: 'Credit Cap', icon: 'price_check', route: '/billing/credit-costs', roles: TENANT_ADMIN_ONLY },
      ],
    },
    {
      label: 'Settings',
      items: [
        { label: 'Reports', icon: 'bar_chart', route: '/reports', roles: REPORT_ROLES },
        { label: 'Agent Performance', icon: 'monitoring', route: '/agent-performance', roles: TENANT_ADMIN_ONLY },
        { label: 'WhatsApp Settings', icon: 'settings', route: '/tenant-settings', roles: TENANT_ADMIN_ONLY },
        { label: 'Consent Page', icon: 'fact_check', route: '/consent-page-settings', roles: TENANT_ADMIN_ONLY },
        { label: 'Users & Roles', icon: 'manage_accounts', route: '/users', roles: TENANT_ADMIN_ONLY, quotaKey: 'Users' },
        { label: 'Test Notifications', icon: 'science', route: '/billing/notifications/test', roles: TENANT_ADMIN_ONLY },
      ],
    },
  ];

  /**
   * The Platform Admin Console's 7 screens, laid out as the same vertical sidenav list the tenant
   * nav uses — not the horizontal tab strip PlatformShellComponent used to render internally. One
   * consistent nav shape for both roles; only the destinations differ. Tenant detail
   * (`tenants/:id`) is deliberately not one of these entries — it's reached from the Tenants list,
   * not navigated to directly.
   *
   * "Configuration" (the pre-existing, separately-lazy-loaded SettingsModule at /settings) used to
   * be listed here too - removed from the nav by request, since per-tenant Campaigns/Media/
   * Messaging/Ai tuning now lives on each tenant's own detail page (see
   * PlatformTenantConfigOverridesDialogComponent) and the remaining platform-global-only categories
   * (WhatsApp/AiProviders infra knobs, MediaStorage) are rarely touched day to day. The
   * route itself is untouched - still reachable at /settings for whoever knows the URL - only the
   * sidebar shortcut is gone.
   */
  readonly platformNavSections: NavSection[] = [
    {
      label: null,
      items: [{ label: 'Dashboard', icon: 'dashboard', route: '/platform/dashboard', roles: [] }],
    },
    {
      label: 'Tenants',
      items: [
        { label: 'Tenants', icon: 'business', route: '/platform/tenants', roles: [] },
        { label: 'Users', icon: 'manage_accounts', route: '/platform/users', roles: [] },
        { label: 'Announcements', icon: 'campaign', route: '/platform/announcements', roles: [] },
        { label: 'Tenant Notifications', icon: 'forward_to_inbox', route: '/platform/tenant-notifications', roles: [] },
        { label: 'Knowledge Base', icon: 'menu_book', route: '/platform/knowledge', roles: [] },
        { label: 'Studio Questionnaires', icon: 'quiz', route: '/platform/studio-questionnaires', roles: [] },
        { label: 'Video Requests', icon: 'movie', route: '/platform/video-requests', roles: [] },
      ],
    },
    {
      label: 'Revenue',
      items: [
        { label: 'Package', icon: 'payments', route: '/platform/billing', roles: [] },
        { label: 'Usage & Quotas', icon: 'data_usage', route: '/platform/usage', roles: [] },
        { label: 'Credit Costs & Payers', icon: 'account_balance_wallet', route: '/platform/credit-payers', roles: [] },
        { label: 'Service Margins', icon: 'trending_up', route: '/platform/service-margins', roles: [] },
        { label: 'Revenue Report', icon: 'bar_chart', route: '/platform/revenue', roles: [] },
        { label: 'Payments', icon: 'receipt_long', route: '/platform/payments', roles: [] },
        { label: 'Refund Requests', icon: 'assignment_return', route: '/platform/refunds', roles: [] },
      ],
    },
    {
      // The platform's own WhatsApp: the number tenant notices are sent from, the template behind each notice, and the images they show.
      label: 'WhatsApp Notices',
      items: [
        { label: 'Platform WhatsApp', icon: 'chat', route: '/platform/whatsapp-settings', roles: [] },
        { label: 'WhatsApp Provider', icon: 'swap_horiz', route: '/platform/whatsapp-provider', roles: [] },
        { label: 'Notice Templates', icon: 'description', route: '/platform/notice-templates', roles: [] },
        { label: 'Notice Media', icon: 'perm_media', route: '/platform/notice-media', roles: [] },
      ],
    },
    {
      label: 'Infrastructure',
      items: [
        {
          label: 'WhatsApp Connections',
          icon: 'cloud_sync',
          route: '/platform/whatsapp-connections',
          roles: [],
        },
      ],
    },
    {
      // The platform-wide system settings, split in two: the one AI provider (AiProviders) every tenant runs on, and the rest.
      label: 'Configuration',
      items: [
        { label: 'General', icon: 'tune', route: '/platform/configuration', roles: [] },
        { label: 'AI Providers', icon: 'smart_toy', route: '/settings/ai-providers', roles: [] },
        { label: 'Tenant Settings', icon: 'tune', route: '/settings/tenant', roles: [] },
        { label: 'AWS Settings', icon: 'cloud', route: '/platform/aws-settings', roles: [] },
        { label: 'SMTP/SMS Settings', icon: 'forward_to_inbox', route: '/platform/delivery-settings', roles: [] },
        { label: 'Features', icon: 'toggle_on', route: '/platform/features', roles: [] },
        { label: 'Integrations', icon: 'hub', route: '/platform/integration-settings', roles: [] },
        { label: 'Simulator Dummy Data', icon: 'dataset', route: '/platform/simulator-data', roles: [] },
        { label: 'Razorpay', icon: 'science', route: '/platform/razorpay-test', roles: [] },
        { label: 'Meta Ads', icon: 'ads_click', route: '/settings/meta-ads', roles: [] },
      ],
    },
    {
      label: 'Monitoring',
      items: [
        { label: 'Logs', icon: 'receipt_long', route: '/platform/logs', roles: [] },
        { label: 'Audit Log', icon: 'history', route: '/platform/audit-log', roles: [] },
        { label: 'Database Size', icon: 'storage', route: '/platform/database-size', roles: [] },
      ],
    },
    {
      // The operator's own account. It lives in the nav as well as the account menu because this is the
      // only profile screen a PlatformSuperAdmin has — they belong to no tenant, so the tenant-scoped
      // Users screens can neither see nor edit them.
      label: 'Account',
      items: [
        { label: 'My Profile', icon: 'person', route: '/account/profile', roles: [] },
        { label: 'Change Password', icon: 'lock_reset', route: '/account/change-password', roles: [] },
      ],
    },
  ];

  /** True for the platform operator account — read once, not as an Observable, same reasoning as
   * isImpersonating below (the role on a signed-in session never changes mid-session). Drives which
   * of the two nav lists the template renders. */
  readonly isPlatformSuperAdmin = this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES);

  /** Account-menu entry for the tenant's Business Profile; tenant admins only, matching the route's role gate. */
  readonly canSeeBusinessProfile = !this.isPlatformSuperAdmin && this.auth.hasAnyRole(TENANT_ADMIN_ONLY);

  /** What the sidenav renders — both roles share the same grouped markup and styling. */
  readonly navSections: NavSection[] = this.isPlatformSuperAdmin
    ? this.platformNavSections
    : this.tenantNavSections;

  /** Hides a section heading when the user can see none of its items (e.g. Workspace for an agent).
   * Items themselves are still filtered by *appHasRole in the template. */
  isSectionVisible(section: NavSection): boolean {
    return section.items.some((item) => this.auth.hasAnyRole(item.roles) && this.isItemVisible(item));
  }

  private canOpenProductKnowledge(): boolean {
    return this.auth.hasAnyRole(TENANT_ADMIN_ONLY) && this.entitlements.canView('ProductKnowledge');
  }

  private canOpenStudio(): boolean {
    return this.studioEnabled && this.entitlements.canView('ContentStudio');
  }

  /** An entry shows when its own switch allows it. One whose feature is not in the plan still shows, locked (see isLocked). */
  isItemVisible(item: NavItem): boolean {
    return !item.visible || item.visible();
  }

  /** The feature the tenant's plan lacks that locks this entry, or null when it is open (always, until the plan is known). A feature whose free uses
   * are used up is not locked: its screens open read-only, so the tenant still sees what it made. */
  lockedFeature(item: NavItem): PlatformFeature | null {
    const feature = typeof item.feature === 'function' ? item.feature() : item.feature;
    return feature && !this.entitlements.canView(feature) ? feature : null;
  }

  isLocked(item: NavItem): boolean {
    return this.lockedFeature(item) !== null;
  }

  /** The free uses an open entry is running on (one of its features is outside the plan but has free uses left), or null. */
  trialOf(item: NavItem): FeatureTrial | null {
    const named = typeof item.feature === 'function' ? item.feature() : item.feature;
    const features = [...(named ? [named] : []), ...(item.trialFeatures ?? [])];
    for (const feature of features) {
      const trial = this.openTrial(feature);
      if (trial) {
        return trial;
      }
    }
    return null;
  }

  private openTrial(feature: PlatformFeature): FeatureTrial | null {
    if (!this.entitlements.has(feature)) {
      return null;
    }
    const trial = this.entitlements.trialOf(feature);
    return trial && !trial.exhausted ? trial : null;
  }

  /** AI-suggested follow-ups nobody has confirmed or dismissed yet - the number on the Follow-ups entry. */
  followUpsToApprove = 0;

  /** "2 to approve", for the entry that asks for it, only while something is waiting. */
  approveChip(item: NavItem): string | null {
    return item.approveChip && this.followUpsToApprove > 0 ? `${this.followUpsToApprove} to approve` : null;
  }

  private refreshFollowUpsToApprove(): void {
    if (this.isPlatformSuperAdmin) {
      return;
    }
    this.injector
      .get(LeadFollowUpService)
      .getSummary()
      .subscribe({ next: (summary) => (this.followUpsToApprove = summary.suggested), error: () => undefined });
  }

  /** "3/10" (used / allocated), for the chip beside an entry with a free-use quota, a plan cap or a plan limit. Full means read-only. */
  trialChip(item: NavItem): string | null {
    if (item.quotaKey) {
      const quota = this.entitlements.quotaOf(item.quotaKey);
      return quota ? `${quota.used}/${quota.limit}` : null;
    }
    const trial = this.trialOf(item);
    if (trial) {
      return `${trial.used}/${trial.freeUses}`;
    }
    const named = typeof item.feature === 'function' ? item.feature() : item.feature;
    const spent = named ? this.entitlements.usedUp(named) : null;
    return spent ? `${spent.used}/${spent.freeUses}` : null;
  }

  /**
   * The free uses the page on screen is running on, for the bar above it: "Lead discovery: 7 of 10 free leads left on your Basic plan". Null on any
   * page whose feature is in the plan, and for a platform admin.
   */
  get currentTrial(): FeatureTrial | null {
    if (this.isPlatformSuperAdmin) {
      return null;
    }
    // Read from the page's own address, so a screen behind a shared entry (Knowledge holds product knowledge and the studio) shows its own feature.
    const path = this.router.url.split(/[?#]/)[0];
    const match = FEATURE_ROUTES.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'));
    return match ? this.openTrial(match[1]) : null;
  }

  /**
   * The free uses (or plan cap) the page on screen has used up, for the read-only bar above it: what is there stays readable, adding new needs Premium.
   * Null while any are left, on any page whose feature is in the plan, and for a platform admin.
   */
  get currentUsedUp(): FeatureTrial | null {
    if (this.isPlatformSuperAdmin) {
      return null;
    }
    const path = this.router.url.split(/[?#]/)[0];
    const match = FEATURE_ROUTES.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'));
    return match ? this.entitlements.usedUp(match[1]) : null;
  }

  usedUpLine(trial: FeatureTrial): string {
    const what =
      trial.feature === 'AiConversations'
        ? 'The AI has stopped replying; you can still read your chats and answer them yourself.'
        : 'You can still see everything here; upgrade to Premium to add new.';
    return `${trialUsedUpLabel(trial, this.entitlements.current?.planName ?? null)} ${what}`;
  }

  trialLine(trial: FeatureTrial): string {
    return `${trial.label}: ${trialLeftLabel(trial)} on your ${this.entitlements.current?.planName || 'current'} plan.`;
  }

  /** Where the entry goes: the feature's preview when locked, otherwise its own screen. */
  routeOf(item: NavItem): string {
    const locked = this.lockedFeature(item);
    if (locked) {
      return featurePreviewUrl(locked);
    }
    return item.link ? item.link() : item.route;
  }

  /** Nav groups the user has folded away, by label. Remembered on this browser; a group holding the page being viewed never folds. */
  private collapsedSections = this.loadCollapsedSections();

  isCollapsed(section: NavSection): boolean {
    return !!section.label && this.collapsedSections.has(section.label) && !this.holdsCurrentPage(section);
  }

  toggleSection(section: NavSection): void {
    if (!section.label || this.holdsCurrentPage(section)) {
      return;
    }
    if (!this.collapsedSections.delete(section.label)) {
      this.collapsedSections.add(section.label);
    }
    try {
      localStorage.setItem(COLLAPSED_NAV_KEY, JSON.stringify([...this.collapsedSections]));
    } catch {
      // Private window or blocked storage: the fold still works for this visit.
    }
  }

  /** True when the page on screen is one of the group's items, so the group stays open around it. */
  private holdsCurrentPage(section: NavSection): boolean {
    const path = this.router.url.split(/[?#]/)[0];
    return section.items.some((item) =>
      this.claimsPath(item, path) ||
      this.router.isActive(item.route, {
        paths: item.exact ? 'exact' : 'subset',
        queryParams: 'ignored',
        fragment: 'ignored',
        matrixParams: 'ignored',
      })
    );
  }

  private claimsPath(item: NavItem, path: string): boolean {
    return !!item.matches?.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
  }

  /** True when the current page is one of the extra routes an entry claims (see NavItem.matches). */
  claimsCurrentPage(item: NavItem): boolean {
    return this.claimsPath(item, this.router.url.split(/[?#]/)[0]);
  }

  private loadCollapsedSections(): Set<string> {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_NAV_KEY) ?? '[]');
      return new Set(Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string') : []);
    } catch {
      return new Set();
    }
  }

  readonly currentUser$: Observable<User | null> = this.auth.currentUser$;

  readonly isHandset$: Observable<boolean> = this.breakpoints
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  /** Whether the sidenav is open - the toggle button (shown on every screen size, not just
   * handset) flips this via drawer.toggle(), and MatSidenav's own openedChange (backdrop click,
   * Esc, a nav item's own close on mobile) writes back through the [(opened)] binding in the
   * template, so this always reflects what's actually on screen. Reset to the sensible default
   * for the viewport - open on desktop, closed on handset - only when the breakpoint itself
   * changes (a resize across it), never on every change-detection pass, so a manual toggle isn't
   * fought back open/closed between resizes. */
  sidenavOpened = true;

  /** Read once, not as an Observable — it never changes mid-session (a fresh tab per
   * ImpersonationSessionService is required to start one at all). */
  readonly isImpersonating = this.auth.isImpersonating;

  /** True while the signed-in user has not yet confirmed their email (only self-signups start that way). Absent on older cached
   * sessions, which count as confirmed; a support session is never nagged on the customer's behalf. */
  readonly emailUnconfirmed$ = this.auth.currentUser$.pipe(map((user) => !this.auth.isImpersonating && user?.emailConfirmed === false));
  resendingVerification = false;
  verificationResent = false;

  /** Active announcements not yet dismissed on this browser — every signed-in user, any tenant,
   * per AnnouncementsController.GetActive's own doc comment. Skipped entirely during an
   * impersonation session: a support session showing the impersonated tenant's own banners would
   * be confusing noise for the PlatformSuperAdmin running it. */
  announcements: Announcement[] = [];

  /** Unread billing alerts (running low, used up, credits expiring, refund decisions) - a tenant admin's bell.
   * Never shown to the platform operator, and skipped in a support session so looking at a tenant's alerts can
   * never mark them read. */
  /** True once the platform has switched the AI Content Studio on; until then its sidenav entry stays hidden. */
  studioEnabled = false;

  /** Admins and Sales Managers get the studio's questionnaire and facts links - never the platform operator, and not in a support session. */
  readonly showStudioNav = !this.isPlatformSuperAdmin && !this.auth.isImpersonating && this.auth.hasAnyRole(STUDIO_CONTENT_ROLES);

  readonly showBillingBell = !this.isPlatformSuperAdmin && !this.auth.isImpersonating && this.auth.hasAnyRole(TENANT_ADMIN_ONLY);
  billingAlerts: TenantNotification[] = [];
  /** The tenant's own IANA timezone — billing notification times are shown in it, whoever is reading. Null
   * until loaded, when the pipe falls back to the user's own zone. */
  tenantTimezone: string | null = null;

  /** Background-job alerts for the platform operator (a tenant's job failing repeatedly, or recovering). Shared
   * across operators, and skipped in a support session for the same reason the billing bell is. */
  readonly showPlatformBell = this.isPlatformSuperAdmin && !this.auth.isImpersonating;
  platformAlerts: PlatformNotification[] = [];

  /** Set while this tenant's onboarding is incomplete: the sidenav is hidden (there is nowhere else to go yet) and
   * every screen but the wizard itself shows a bar leading back to it. Never set for a PlatformSuperAdmin or in a
   * support session - the onboarding guard does not hold either of them. */
  onboarding: OnboardingStatus | null = null;
  onOnboardingPage = false;
  checkingOnboarding = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly auth: AuthService,
    private readonly breakpoints: BreakpointObserver,
    private readonly announcementService: AnnouncementService,
    private readonly account: AccountService,
    private readonly billing: BillingService,
    private readonly contentStudio: ContentStudioService,
    private readonly entitlements: EntitlementsStore,
    private readonly entitlementsLoader: EntitlementsService,
    private readonly platformNotifications: PlatformNotificationService,
    private readonly notificationHub: NotificationHubService,
    private readonly tenantProfile: TenantProfileService,
    private readonly notificationsChanged: NotificationsChangedService,
    private readonly recovery: AccountRecoveryService,
    private readonly onboardingService: OnboardingService,
    private readonly router: Router,
    private readonly injector: Injector,
    private readonly dialog: MatDialog
  ) {}

  get onboardingActive(): boolean {
    return !!this.onboarding && !this.onboarding.isCompleted;
  }

  /** Setup is not finished: some step is not Completed (one on hold counts - the tenant can come back to it). Drives the spinner chip in the top bar. */
  get setupInProgress(): boolean {
    return !!this.onboarding && !this.onboardingActive && this.onboarding.steps.some((s) => s.state !== 'Completed');
  }

  /** What the spinner chip says on hover: the progress and what is still to do. */
  get setupTooltip(): string {
    if (!this.onboarding) {
      return '';
    }
    const left = this.onboarding.steps.filter((s) => s.state !== 'Completed').map((s) => s.title);
    return `Setup ${this.onboarding.progressPercent}% complete. Still to do: ${left.join(', ')}. Click to continue.`;
  }

  get onboardingStep(): OnboardingStep | null {
    return currentStep(this.onboarding);
  }

  /** "Check this step" from the bar on a step's own screen: back to the wizard once it is done. */
  checkOnboardingStep(): void {
    if (this.checkingOnboarding) {
      return;
    }
    const before = this.onboardingStep?.key ?? null;
    this.checkingOnboarding = true;
    this.onboardingService
      .refresh()
      .pipe(finalize(() => (this.checkingOnboarding = false)))
      .subscribe({
        next: (status) => {
          if (status && (status.isCompleted || status.currentStepKey !== before)) {
            void this.router.navigate(['/onboarding']);
          }
        },
        error: () => undefined,
      });
  }

  /** The nav group ("category") and entry the router is currently on - shown in the toolbar as an eyebrow + title. */
  currentCategory: string | null = null;
  currentTitle = '';

  /** Screens with no sidebar entry that still name themselves in the toolbar: Tickets has its own button in the top bar, and Background Jobs is reached
   * from alerts and from a tenant's page. */
  private readonly unlistedHeadings: { route: string; category: string; title: string }[] = [
    { route: '/platform/tickets', category: 'Support', title: 'Tickets' },
    { route: '/platform/jobs', category: 'Infrastructure', title: 'Background Jobs' },
  ];

  /** Longest nav route that prefixes the url wins, so /platform/tenants/42 still reads "Tenants". */
  private updateHeading(url: string): void {
    const path = url.split(/[?#]/)[0];
    let best: { section: NavSection; item: NavItem } | null = null;
    for (const section of this.navSections) {
      for (const item of section.items) {
        const claimed = this.claimsPath(item, path);
        const hit = claimed || path === item.route || path.startsWith(item.route + '/');
        if (hit && (!best || claimed || item.route.length > best.item.route.length)) {
          best = { section, item };
        }
      }
    }
    const unlisted = best ? undefined : this.unlistedHeadings.find((h) => path === h.route || path.startsWith(h.route + '/'));
    this.currentCategory = best?.section.label ?? unlisted?.category ?? null;
    this.currentTitle = best?.item.label ?? unlisted?.title ?? '';
  }

  /** The credits left in the wallet, shown beside the bell - null until known (and never for a platform admin, who has no wallet). */
  /** The platform admin's own wallet - rupees loaded into the AI providers. Looked up only for a platform admin, so a tenant's shell never builds it. */
  readonly platformWalletBalance$ = this.showPlatformBell
    ? this.injector.get(PlatformWalletService).summary$.pipe(map((s) => (s ? s.balance : null)))
    : of<number | null>(null);

  addWalletCredit(): void {
    this.dialog.open(PlatformWalletTopUpDialogComponent, { width: '440px', maxWidth: '95vw' });
  }

  readonly walletBalance$ = this.entitlements.entitlements$.pipe(map((e) => (e ? e.balance : null)));

  /** Whether the wallet figure sits in the toolbar: every tenant user sees it, but only an Admin can open the wallet page behind it. */
  get showWallet(): boolean {
    return !this.isPlatformSuperAdmin && !this.onboardingActive && !this.onOnboardingPage;
  }

  get canOpenWallet(): boolean {
    return this.auth.hasAnyRole(TENANT_ADMIN_ONLY);
  }

  ngOnInit(): void {
    this.updateHeading(this.router.url);
    this.refreshFollowUpsToApprove();
    if (!this.isPlatformSuperAdmin) {
      // Approving or dismissing a suggestion changes the count, so it is read again straight away rather than on the next page change.
      this.injector.get(LeadFollowUpService).changed$?.pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshFollowUpsToApprove());
    }
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((e) => {
        this.updateHeading(e.urlAfterRedirects);
        // A ticket is resolved on its own page, so the badge is read again as the operator moves on, not on the next tick.
        this.refreshOpenTickets();
        // Suggestions are confirmed or dismissed on the Follow-ups page and on a lead, so the count is read again as the tenant moves on.
        this.refreshFollowUpsToApprove();
        // Credits are spent in the background and by what the tenant does on any page, so the figure is read again as they move around.
        if (!this.isPlatformSuperAdmin) {
          this.entitlementsLoader.load(true).subscribe({ error: () => undefined });
        }
      });

    // Unconditional - the sidenav's open/close toggle works the same in a support session as
    // anywhere else, so it isn't gated behind the isImpersonating early return below.
    this.isHandset$.pipe(takeUntil(this.destroy$)).subscribe((isHandset) => {
      this.sidenavOpened = !isHandset && !this.onboardingActive;
    });

    if (!this.isPlatformSuperAdmin && !this.isImpersonating) {
      this.onboardingService.status$.pipe(takeUntil(this.destroy$)).subscribe((status) => {
        const wasActive = this.onboardingActive;
        const wasComplete = !!this.onboarding?.isCompleted;
        this.onboarding = status;
        if (this.onboardingActive) {
          this.sidenavOpened = false;
          // Setup was just undone (the only package deleted, say): back to the wizard, wherever the tenant was.
          if (wasComplete && !this.router.url.startsWith('/onboarding')) {
            void this.router.navigate(['/onboarding']);
          }
        } else if (this.onOnboardingPage) {
          this.sidenavOpened = false;
        } else if (wasActive) {
          // Just finished: the full workspace opens up.
          this.sidenavOpened = !this.breakpoints.isMatched(Breakpoints.Handset);
        }
      });
      this.onOnboardingPage = this.router.url.startsWith('/onboarding');
      if (this.onOnboardingPage) {
        this.sidenavOpened = false;
      }
      this.router.events
        .pipe(
          filter((e): e is NavigationEnd => e instanceof NavigationEnd),
          takeUntil(this.destroy$)
        )
        .subscribe((e) => {
          const wasOnPage = this.onOnboardingPage;
          this.onOnboardingPage = e.urlAfterRedirects.startsWith('/onboarding');
          // The onboarding page never shows the side navigation; leaving it brings it back (unless setup still blocks it).
          if (this.onOnboardingPage) {
            this.sidenavOpened = false;
          } else if (wasOnPage && !this.onboardingActive) {
            this.sidenavOpened = !this.breakpoints.isMatched(Breakpoints.Handset);
          }
        });
    }

    if (this.isImpersonating) {
      return;
    }

    // Caches this user's display timezone so ZonedDatePipe renders in it from the first paint. Skipped
    // during a support session on purpose: localStorage is shared across same-origin tabs, so storing the
    // impersonated user's zone would change how the operator's own tab renders (same hazard AuthService's
    // clearSession documents for the cached user).
    this.account.getProfile().subscribe({ error: () => undefined });

    if (this.showStudioNav) {
      this.contentStudio.getStatus().subscribe({
        next: (status) => (this.studioEnabled = status.enabled),
        error: () => undefined,
      });
    }

    if (this.showBillingBell) {
      this.tenantProfile.getProfile().subscribe({
        next: (profile) => (this.tenantTimezone = profile.timezone ?? null),
        error: () => undefined,
      });

      // Now and every few minutes after: quota alerts are raised by a job every 15 minutes, so polling faster
      // than this would only ask the same question twice.
      timer(0, 3 * 60 * 1000)
        .pipe(
          switchMap(() => this.billing.getNotifications()),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (all) => (this.billingAlerts = this.newestFirst(all)),
          error: () => undefined,
        });
    }

    if (this.showPlatformBell) {
      this.injector.get(PlatformWalletService).refresh();

      // Job runs are minutely at their fastest, so a minute is the useful resolution for noticing a failure.
      timer(0, 60 * 1000)
        .pipe(
          switchMap(() => this.platformNotifications.getRecent()),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (all) => (this.platformAlerts = this.newestFirst(all)),
          error: () => undefined,
        });

      // The Tickets button's badge: the tickets nobody has picked up yet. Read with the alerts, and again on every page change (see above).
      timer(0, 60 * 1000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.refreshOpenTickets());
    }

    // The full Notifications screen reads and deletes too; refresh the bell the moment it does, not on the next poll.
    this.notificationsChanged.changed$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.showBillingBell) {
        this.billing.getNotifications().subscribe({ next: (all) => (this.billingAlerts = this.newestFirst(all)), error: () => undefined });
      }
      if (this.showPlatformBell) {
        this.platformNotifications.getRecent().subscribe({ next: (all) => (this.platformAlerts = this.newestFirst(all)), error: () => undefined });
      }
    });

    this.announcementService.getActive().subscribe({
      next: (announcements) => {
        const dismissed = this.dismissedIds();
        this.announcements = announcements.filter((a) => !dismissed.has(a.id));
      },
      error: () => (this.announcements = []),
    });

    // Live push on top of the polling above, so a new alert shows up the moment it's raised rather
    // than on the next tick — the poll stays as the fallback for a connection that never came up.
    if (this.showBillingBell || this.showPlatformBell) {
      this.notificationHub.connect();
      this.notificationHub.notificationReceived$.pipe(takeUntil(this.destroy$)).subscribe((payload) => {
        this.onLiveNotification(payload);
      });
    }
  }

  /** Emails a fresh confirmation link. The banner then says so instead of offering the button again. */
  resendVerification(): void {
    if (this.resendingVerification) {
      return;
    }
    this.resendingVerification = true;
    this.recovery
      .resendVerificationEmail()
      .pipe(finalize(() => (this.resendingVerification = false)))
      .subscribe({
        next: () => (this.verificationResent = true),
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.notificationHub.disconnect();
  }

  /** Prepends a live push into whichever bell's list is active on this session — a signed-in user is
   * either a tenant user or a platform operator, never both, so only one of the two branches below
   * ever actually runs for a given connection. Deduped against the id in case the next poll tick
   * already picked the same notification up first. */
  private onLiveNotification(payload: unknown): void {
    if (this.showBillingBell) {
      const notification = payload as TenantNotification;
      if (!this.billingAlerts.some((a) => a.id === notification.id)) {
        this.billingAlerts = this.newestFirst([notification, ...this.billingAlerts]);
      }
    } else if (this.showPlatformBell) {
      const notification = payload as PlatformNotification;
      if (!this.platformAlerts.some((a) => a.id === notification.id)) {
        this.platformAlerts = this.newestFirst([notification, ...this.platformAlerts]);
      }
    }
  }

  /** Opening an alert goes to where it can be dealt with, not always the same screen. */
  billingAlertLink(alert: TenantNotification): string {
    return tenantNotificationRoute(alert.kind);
  }

  /** The banner's button: where the notice is dealt with. Quota alerts are fixed by buying credits; others (e.g. the consent page) go to their own screen. */
  billingBannerLabel(alert: TenantNotification): string {
    return tenantNotificationActionLabel(alert.kind) ?? (tenantNotificationRoute(alert.kind) === '/billing/wallet' ? 'Buy credits' : 'Open');
  }

  /** "Complete Setup" for a notice the tenant has to act on; null for the rest. */
  billingAlertAction(alert: TenantNotification): string | null {
    return tenantNotificationActionLabel(alert.kind);
  }

  platformAlertLink(alert: PlatformNotification): string {
    return platformNotificationRoute(alert);
  }

  platformAlertUrgent(alert: PlatformNotification): boolean {
    return alert.severity === 'Critical';
  }

  /** The bells keep read notifications (greyed out) so the list is a history; only the delete action removes one. */
  get unreadBillingCount(): number {
    return this.billingAlerts.filter((n) => !n.acknowledged).length;
  }

  get unreadPlatformCount(): number {
    return this.platformAlerts.filter((n) => !n.acknowledged).length;
  }

  /** Tickets raised for the product owner that are still Open - nobody has picked them up. Shown as a badge on the Tickets button. */
  openTicketCount = 0;

  private refreshOpenTickets(): void {
    if (!this.showPlatformBell) {
      return;
    }
    this.injector
      .get(PlatformTicketService)
      .getAll('Open')
      .subscribe({ next: (tickets) => (this.openTicketCount = tickets.length), error: () => undefined });
  }

  /** What the Tickets button says to a screen reader and in its tooltip: how many are waiting, when any are. */
  get ticketsLabel(): string {
    return this.openTicketCount ? `Tickets, ${this.openTicketCount} open` : 'Tickets';
  }

  private newestFirst<T extends { createdAt: string }>(list: T[]): T[] {
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Marks the alert read as it is opened — the click is the operator seeing it. It stays in the list, greyed. */
  openPlatformAlert(alert: PlatformNotification): void {
    if (alert.acknowledged) {
      return;
    }
    this.platformAlerts = this.platformAlerts.map((n) => (n.id === alert.id ? { ...n, acknowledged: true } : n));
    this.platformNotifications.acknowledge(alert.id).subscribe({ error: () => undefined });
  }

  acknowledgeAllPlatformAlerts(): void {
    this.platformAlerts = this.platformAlerts.map((n) => ({ ...n, acknowledged: true }));
    this.platformNotifications.acknowledgeAll().subscribe({ error: () => undefined });
  }

  urgentAlert(alert: TenantNotification): boolean {
    return isUrgentNotification(alert.kind);
  }

  /** Urgent alerts (quota exhausted, near-exhausted, credits/plan about to lapse) as a banner on every
   * page — not just the bell, which a tenant can go a whole session without opening. Stays until
   * acknowledged or deleted; nothing here auto-dismisses. */
  get urgentBillingAlerts(): TenantNotification[] {
    return this.billingAlerts.filter((a) => !a.acknowledged && this.urgentAlert(a));
  }

  /** Marks one billing alert read without navigating anywhere - the bell's own "mark as read" action. */
  acknowledgeBillingAlert(alert: TenantNotification): void {
    this.billingAlerts = this.billingAlerts.map((n) => (n.id === alert.id ? { ...n, acknowledged: true } : n));
    this.billing.acknowledgeNotification(alert.id).subscribe({ error: () => undefined });
  }

  acknowledgeAllBillingAlerts(): void {
    this.billingAlerts = this.billingAlerts.map((n) => ({ ...n, acknowledged: true }));
    this.billing.acknowledgeAllNotifications().subscribe({ error: () => undefined });
  }

  deleteBillingAlert(alert: TenantNotification): void {
    this.billingAlerts = this.billingAlerts.filter((n) => n.id !== alert.id);
    this.billing.deleteNotification(alert.id).subscribe({ error: () => undefined });
  }

  deletePlatformAlert(alert: PlatformNotification): void {
    this.platformAlerts = this.platformAlerts.filter((n) => n.id !== alert.id);
    this.platformNotifications.delete(alert.id).subscribe({ error: () => undefined });
  }

  dismiss(announcement: Announcement): void {
    this.announcements = this.announcements.filter((a) => a.id !== announcement.id);
    const dismissed = this.dismissedIds();
    dismissed.add(announcement.id);
    localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify([...dismissed]));
  }

  private dismissedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  initials(user: User | null): string {
    if (!user?.fullName) {
      return '?';
    }
    return user.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  logout(): void {
    this.auth.logout();
  }

  /** Ends a Platform Admin Console support session. Closes the tab when it was opened via
   * window.open (the normal path — see ImpersonationSessionService), since window.close() is a
   * no-op the browser silently ignores for a tab the script didn't open itself; falls back to
   * /login for the rare case this tab was reached some other way (e.g. a bookmarked/shared URL). */
  endImpersonation(): void {
    this.auth.endImpersonation();
    if (window.opener) {
      window.close();
    } else {
      window.location.href = '/login';
    }
  }
}

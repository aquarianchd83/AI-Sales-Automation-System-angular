import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { map, shareReplay, switchMap, takeUntil } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { AppRole, User } from '../../core/models/user.model';
import { Announcement, PLATFORM_ADMIN_ROLES, PlatformNotification } from '../../core/models/platform.model';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { TenantNotification, isUrgentNotification } from '../../core/models/billing.model';
import { BillingService } from '../../core/services/billing.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
  /** Highlight only on an exact route match - for a parent route whose child has its own nav entry. */
  exact?: boolean;
}

/** A labelled group of nav items. `label` null renders the items with no heading. */
interface NavSection {
  label: string | null;
  items: NavItem[];
}

const TENANT_ADMIN_ONLY = [AppRole.SuperAdmin, AppRole.Admin];

/** localStorage key for the set of announcement ids this browser has dismissed — a per-viewer
 * convenience (see TokenStorageService's own doc comment on why localStorage is already this
 * app's storage of choice), not synced anywhere, so dismissing on one device/browser doesn't
 * dismiss it on another. */
const DISMISSED_ANNOUNCEMENTS_KEY = 'wsa.dismissedAnnouncementIds';

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
   * content, running the workspace) so thirteen links scan as four short lists.
   */
  readonly tenantNavSections: NavSection[] = [
    {
      label: null,
      items: [{ label: 'Dashboard', icon: 'dashboard', route: '/dashboard', roles: [] }],
    },
    {
      label: 'Engage',
      items: [
        { label: 'Inbox', icon: 'inbox', route: '/conversations', roles: [] },
        { label: 'Handoffs', icon: 'support_agent', route: '/handoffs', roles: [] },
        { label: 'Campaigns', icon: 'campaign', route: '/campaigns', roles: [] },
      ],
    },
    {
      label: 'CRM',
      items: [
        { label: 'Customers', icon: 'groups', route: '/customers', roles: [] },
        { label: 'Leads', icon: 'insights', route: '/leads', roles: [] },
        { label: 'Lead Discovery', icon: 'travel_explore', route: '/lead-discovery', roles: [] },
        { label: 'Tags', icon: 'sell', route: '/tags', roles: [] },
      ],
    },
    {
      label: 'Content',
      items: [
        { label: 'Message Templates', icon: 'text_snippet', route: '/message-templates', roles: [] },
        { label: 'Media Library', icon: 'perm_media', route: '/media', roles: [] },
        { label: 'Knowledge Base', icon: 'menu_book', route: '/knowledge-base', roles: [] },
      ],
    },
    {
      label: 'Workspace',
      items: [
        { label: 'Business Profile', icon: 'storefront', route: '/profile', roles: TENANT_ADMIN_ONLY },
        { label: 'Users & Roles', icon: 'manage_accounts', route: '/users', roles: TENANT_ADMIN_ONLY },
        { label: 'Settings', icon: 'settings', route: '/tenant-settings', roles: TENANT_ADMIN_ONLY },
        { label: 'Billing', icon: 'payments', route: '/billing', roles: TENANT_ADMIN_ONLY, exact: true },
        { label: 'Usage & Credits', icon: 'data_usage', route: '/billing/wallet', roles: TENANT_ADMIN_ONLY },
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
      ],
    },
    {
      label: 'Revenue',
      items: [
        { label: 'Package', icon: 'payments', route: '/platform/billing', roles: [] },
        { label: 'Usage & Quotas', icon: 'data_usage', route: '/platform/usage', roles: [] },
        { label: 'Payments', icon: 'receipt_long', route: '/platform/payments', roles: [] },
        { label: 'Refund Requests', icon: 'assignment_return', route: '/platform/refunds', roles: [] },
        { label: 'Configuration', icon: 'tune', route: '/platform/configuration', roles: [] },
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
        { label: 'Background Jobs', icon: 'schedule', route: '/platform/jobs', roles: [] },
      ],
    },
    {
      label: 'Monitoring',
      items: [
        { label: 'Logs', icon: 'receipt_long', route: '/platform/logs', roles: [] },
        { label: 'Audit Log', icon: 'history', route: '/platform/audit-log', roles: [] },
      ],
    },
    {
      // The operator's own account. It lives in the nav as well as the account menu because this is the
      // only profile screen a PlatformSuperAdmin has — they belong to no tenant, so the tenant-scoped
      // Users screens can neither see nor edit them.
      label: 'Account',
      items: [{ label: 'My Profile', icon: 'account_circle', route: '/account/profile', roles: [] }],
    },
  ];

  /** True for the platform operator account — read once, not as an Observable, same reasoning as
   * isImpersonating below (the role on a signed-in session never changes mid-session). Drives which
   * of the two nav lists the template renders. */
  readonly isPlatformSuperAdmin = this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES);

  /** What the sidenav renders — both roles share the same grouped markup and styling. */
  readonly navSections: NavSection[] = this.isPlatformSuperAdmin
    ? this.platformNavSections
    : this.tenantNavSections;

  /** Hides a section heading when the user can see none of its items (e.g. Workspace for an agent).
   * Items themselves are still filtered by *appHasRole in the template. */
  isSectionVisible(section: NavSection): boolean {
    return section.items.some((item) => this.auth.hasAnyRole(item.roles));
  }

  readonly currentUser$: Observable<User | null> = this.auth.currentUser$;

  readonly isHandset$: Observable<boolean> = this.breakpoints
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  /** Read once, not as an Observable — it never changes mid-session (a fresh tab per
   * ImpersonationSessionService is required to start one at all). */
  readonly isImpersonating = this.auth.isImpersonating;

  /** Active announcements not yet dismissed on this browser — every signed-in user, any tenant,
   * per AnnouncementsController.GetActive's own doc comment. Skipped entirely during an
   * impersonation session: a support session showing the impersonated tenant's own banners would
   * be confusing noise for the PlatformSuperAdmin running it. */
  announcements: Announcement[] = [];

  /** Unread billing alerts (running low, used up, credits expiring, refund decisions) - a tenant admin's bell.
   * Never shown to the platform operator, and skipped in a support session so looking at a tenant's alerts can
   * never mark them read. */
  readonly showBillingBell = !this.isPlatformSuperAdmin && !this.auth.isImpersonating && this.auth.hasAnyRole(TENANT_ADMIN_ONLY);
  billingAlerts: TenantNotification[] = [];

  /** Background-job alerts for the platform operator (a tenant's job failing repeatedly, or recovering). Shared
   * across operators, and skipped in a support session for the same reason the billing bell is. */
  readonly showPlatformBell = this.isPlatformSuperAdmin && !this.auth.isImpersonating;
  platformAlerts: PlatformNotification[] = [];
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly auth: AuthService,
    private readonly breakpoints: BreakpointObserver,
    private readonly announcementService: AnnouncementService,
    private readonly account: AccountService,
    private readonly billing: BillingService,
    private readonly platformNotifications: PlatformNotificationService
  ) {}

  ngOnInit(): void {
    if (this.isImpersonating) {
      return;
    }

    // Caches this user's display timezone so ZonedDatePipe renders in it from the first paint. Skipped
    // during a support session on purpose: localStorage is shared across same-origin tabs, so storing the
    // impersonated user's zone would change how the operator's own tab renders (same hazard AuthService's
    // clearSession documents for the cached user).
    this.account.getProfile().subscribe({ error: () => undefined });

    if (this.showBillingBell) {
      // Now and every few minutes after: quota alerts are raised by a job every 15 minutes, so polling faster
      // than this would only ask the same question twice.
      timer(0, 3 * 60 * 1000)
        .pipe(
          switchMap(() => this.billing.getNotifications()),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (all) => (this.billingAlerts = all.filter((n) => !n.acknowledged)),
          error: () => undefined,
        });
    }

    if (this.showPlatformBell) {
      // Job runs are minutely at their fastest, so a minute is the useful resolution for noticing a failure.
      timer(0, 60 * 1000)
        .pipe(
          switchMap(() => this.platformNotifications.getRecent()),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (all) => (this.platformAlerts = all.filter((n) => !n.acknowledged)),
          error: () => undefined,
        });
    }

    this.announcementService.getActive().subscribe({
      next: (announcements) => {
        const dismissed = this.dismissedIds();
        this.announcements = announcements.filter((a) => !dismissed.has(a.id));
      },
      error: () => (this.announcements = []),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  platformAlertUrgent(alert: PlatformNotification): boolean {
    return alert.severity === 'Critical';
  }

  /** Clears the alert as it is opened — the click is the operator seeing it — and leaves the list to the poll. */
  openPlatformAlert(alert: PlatformNotification): void {
    this.platformAlerts = this.platformAlerts.filter((n) => n.id !== alert.id);
    this.platformNotifications.acknowledge(alert.id).subscribe({ error: () => undefined });
  }

  acknowledgeAllPlatformAlerts(): void {
    this.platformAlerts = [];
    this.platformNotifications.acknowledgeAll().subscribe({ error: () => undefined });
  }

  urgentAlert(alert: TenantNotification): boolean {
    return isUrgentNotification(alert.kind);
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

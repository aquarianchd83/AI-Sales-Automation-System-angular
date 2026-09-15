import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { AppRole, User } from '../../core/models/user.model';
import { Announcement, PLATFORM_ADMIN_ROLES } from '../../core/models/platform.model';
import { AnnouncementService } from '../../core/services/announcement.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
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
export class ShellComponent implements OnInit {
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
        { label: 'Billing', icon: 'payments', route: '/billing', roles: TENANT_ADMIN_ONLY },
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
        { label: 'Billing', icon: 'payments', route: '/platform/billing', roles: [] },
        { label: 'Usage & Quotas', icon: 'data_usage', route: '/platform/usage', roles: [] },
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

  constructor(
    private readonly auth: AuthService,
    private readonly breakpoints: BreakpointObserver,
    private readonly announcementService: AnnouncementService
  ) {}

  ngOnInit(): void {
    if (this.isImpersonating) {
      return;
    }
    this.announcementService.getActive().subscribe({
      next: (announcements) => {
        const dismissed = this.dismissedIds();
        this.announcements = announcements.filter((a) => !dismissed.has(a.id));
      },
      error: () => (this.announcements = []),
    });
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

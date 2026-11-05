import { ComponentFixture, discardPeriodicTasks, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, of } from 'rxjs';

import { AccountRecoveryService } from '../../core/services/account-recovery.service';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { BillingService } from '../../core/services/billing.service';
import { ContentStudioService } from '../../core/services/content-studio.service';
import { NotificationHubService } from '../../core/services/notification-hub.service';
import { PlatformNotification } from '../../core/models/platform.model';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { PlatformTicketService } from '../../core/services/platform-ticket.service';
import { PlatformWalletService } from '../../core/services/platform-wallet.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './shell.component';

describe('ShellComponent sidenav', () => {
  /** The tickets the operator would see as Open; a test sets it before building the shell. */
  let openTickets: unknown[] = [];
  let ticketService: { getAll: jasmine.Spy };

  beforeEach(() => {
    openTickets = [];
    ticketService = { getAll: jasmine.createSpy('getAll').and.callFake((status?: string) => of(status === 'Open' ? openTickets : [])) };
  });

  function createFixture(
    roles: string[],
    platformAlerts: PlatformNotification[] = [],
    emailConfirmed?: boolean,
    resend: () => unknown = () => of(undefined)
  ): ComponentFixture<ShellComponent> {
    const auth = {
      currentUser$: of({ fullName: 'Test User', email: 't@example.com', roles, emailConfirmed }),
      isImpersonating: false,
      hasAnyRole: (wanted: string[]) =>
        wanted.length === 0 || wanted.some((role) => roles.includes(role)),
    };

    TestBed.configureTestingModule({
      declarations: [ShellComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OnboardingService, useValue: { status$: of(null), refresh: () => of(null), current: () => of(null) } },
        { provide: AnnouncementService, useValue: { getActive: () => of([]) } },
        { provide: AccountRecoveryService, useValue: { resendVerificationEmail: resend } },
        { provide: AccountService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: ContentStudioService, useValue: { getStatus: () => of({ enabled: false }) } },
        { provide: BillingService, useValue: { getNotifications: () => of([]) } },
        { provide: TenantProfileService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: PlatformNotificationService, useValue: { getRecent: () => of(platformAlerts) } },
        { provide: PlatformTicketService, useValue: ticketService },
        { provide: PlatformWalletService, useValue: { summary$: of({ balance: 0, topUpCount: 0, lastTopUpDate: null }), refresh: () => undefined } },
        { provide: NotificationHubService, useValue: { connect: () => undefined, disconnect: () => undefined, notificationReceived$: NEVER } },
      ],
    });

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return fixture;
  }

  const render = (roles: string[]) => createFixture(roles).nativeElement as HTMLElement;

  const labels = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('.nav-section-label')).map((el) => el.textContent?.trim());
  const items = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('.nav-item')).map((el) => el.textContent?.trim());

  it('groups a tenant admin nav into labelled sections', () => {
    const root = render(['Admin']);

    expect(labels(root)).toEqual(['Outreach', 'Engage', 'Extra', 'Marketing', 'Billing', 'Settings']);
    expect(items(root)).toEqual([
      'dashboardDashboard',
      'travel_exploreLead Discovery',
      'groupsCustomers',
      'text_snippetMessage Templates',
      'campaignCampaigns',
      'psychologyKnowledge',
      'inboxInbox',
      'support_agentHandoffs',
      'insightsLeads',
      'event_availableDemos Scheduled',
      'inventory_2Packages',
      'perm_mediaMedia Library',
      'publicSocial Ads',
      'paymentsMembership',
      'data_usageUsage & Credits',
      'price_checkCredit Cap',
      'bar_chartReports',
      'monitoringAgent Performance',
      'settingsWhatsApp Settings',
      'fact_checkConsent Page',
      'manage_accountsUsers & Roles',
      'scienceTest Notifications',
    ]);
  });

  it('folds a group away when its heading is clicked, and opens it again', () => {
    localStorage.removeItem('wsa.collapsedNavSections');
    const fixture = createFixture(['Admin']);
    const root = fixture.nativeElement as HTMLElement;
    const heading = () => Array.from(root.querySelectorAll<HTMLButtonElement>('.nav-section-label')).find((b) => b.textContent!.trim() === 'Extra')!;
    const section = () => heading().closest('.nav-section')!;

    expect(heading().getAttribute('aria-expanded')).toBe('true');
    expect(section().classList).not.toContain('nav-section--collapsed');

    heading().click();
    fixture.detectChanges();
    expect(heading().getAttribute('aria-expanded')).toBe('false');
    expect(section().classList).toContain('nav-section--collapsed');
    expect(localStorage.getItem('wsa.collapsedNavSections')).toBe('["Extra"]');

    heading().click();
    fixture.detectChanges();
    expect(section().classList).not.toContain('nav-section--collapsed');
    localStorage.removeItem('wsa.collapsedNavSections');
  });

  it('drops every admin-only section for a sales agent', () => {
    const root = render(['SalesAgent']);

    expect(labels(root)).toEqual(['Outreach', 'Engage', 'Extra']);
    expect(items(root)).not.toContain('settingsWhatsApp Settings');
    expect(items(root).length).toBe(11);
  });

  it('sends an Admin straight to Lead Discovery History - the Discovered Leads page would 403 nobody, but History is Admin-only', () => {
    const root = render(['Admin']);

    const link = Array.from(root.querySelectorAll<HTMLAnchorElement>('.nav-item')).find((a) => a.textContent?.trim() === 'travel_exploreLead Discovery');
    expect(link?.getAttribute('href')).toBe('/lead-discovery/history');
  });

  it('keeps a sales agent on Discovered Leads, since History would refuse them', () => {
    const root = render(['SalesAgent']);

    const link = Array.from(root.querySelectorAll<HTMLAnchorElement>('.nav-item')).find((a) => a.textContent?.trim() === 'travel_exploreLead Discovery');
    expect(link?.getAttribute('href')).toBe('/lead-discovery');
  });

  it('groups the platform console nav the same way, with no tenant items', () => {
    const root = render(['PlatformSuperAdmin']);

    expect(labels(root)).toEqual(['Tenants', 'Revenue', 'WhatsApp Notices', 'Infrastructure', 'Configuration', 'Monitoring', 'Account']);
    expect(items(root)).toEqual([
      'dashboardDashboard',
      'businessTenants',
      'manage_accountsUsers',
      'campaignAnnouncements',
      'forward_to_inboxTenant Notifications',
      'menu_bookKnowledge Base', // platform knowledge: stays
      'quizStudio Questionnaires',
      'paymentsPackage',
      'data_usageUsage & Quotas',
      'account_balance_walletCredit Costs & Payers',
      'trending_upService Margins',
      'bar_chartRevenue Report',
      'receipt_longPayments',
      'assignment_returnRefund Requests',
      'chatPlatform WhatsApp',
      'swap_horizWhatsApp Provider',
      'descriptionNotice Templates',
      'perm_mediaNotice Media',
      'cloud_syncWhatsApp Connections',
      'tuneGeneral',
      'smart_toyAI Providers',
      'tuneTenant Settings',
      'cloudAWS Settings',
      'forward_to_inboxSMTP/SMS Settings',
      'hubIntegrations',
      'scienceRazorpay Test',
      'request_quoteAI Provider Charges',
      'ads_clickMeta Ads',
      'receipt_longLogs',
      'historyAudit Log',
      'personMy Profile',
      'lock_resetChange Password',
    ]);
  });

  it('puts Tickets in the top bar of the platform console, not in the sidebar, and leaves Background Jobs out of the sidebar', () => {
    const root = render(['PlatformSuperAdmin']);

    const link = root.querySelector('mat-toolbar [data-testid=tickets-link]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/platform/tickets');
    expect(link.getAttribute('aria-label')).toBe('Tickets');
    expect(link.textContent).toContain('confirmation_number');

    const sidebar = items(root).join('|');
    expect(sidebar).not.toContain('Tickets');
    expect(sidebar).not.toContain('Background Jobs');
    expect(root.querySelector('mat-sidenav a[href="/platform/tickets"]')).toBeNull();
    expect(root.querySelector('mat-sidenav a[href="/platform/jobs"]')).toBeNull();
  });

  describe('the Tickets button badge', () => {
    const badge = (root: HTMLElement) => root.querySelector('[data-testid=tickets-count]');
    const link = (root: HTMLElement) => root.querySelector('[data-testid=tickets-link]') as HTMLAnchorElement;

    /** The count is read on the poll's first tick, like the alerts bell's, so the shell is built and that tick let through. */
    const shellAfterFirstPoll = (roles: string[]) => {
      const fixture = createFixture(roles);
      tick(1);
      fixture.detectChanges();
      return fixture;
    };

    it('counts the open tickets on the icon, and says so to a screen reader and in the tooltip', fakeAsync(() => {
      openTickets = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];

      const root = shellAfterFirstPoll(['PlatformSuperAdmin']).nativeElement as HTMLElement;

      expect(badge(root)?.textContent?.trim()).toBe('3');
      expect(link(root).getAttribute('aria-label')).toBe('Tickets, 3 open');
      // Only the tickets nobody has picked up are counted: the badge asks for Open ones.
      expect(ticketService.getAll).toHaveBeenCalledWith('Open');
      discardPeriodicTasks();
    }));

    it('shows no badge when nothing is open', fakeAsync(() => {
      const root = shellAfterFirstPoll(['PlatformSuperAdmin']).nativeElement as HTMLElement;

      expect(badge(root)).toBeNull();
      expect(link(root).getAttribute('aria-label')).toBe('Tickets');
      discardPeriodicTasks();
    }));

    it('caps the badge at 9+ like the alerts bell', fakeAsync(() => {
      openTickets = Array.from({ length: 14 }, (_, i) => ({ id: 't' + i }));

      const root = shellAfterFirstPoll(['PlatformSuperAdmin']).nativeElement as HTMLElement;

      expect(badge(root)?.textContent?.trim()).toBe('9+');
      expect(link(root).getAttribute('aria-label')).toBe('Tickets, 14 open');
      discardPeriodicTasks();
    }));

    it('is never asked for by a tenant, who has no tickets', fakeAsync(() => {
      openTickets = [{ id: 't1' }];

      const root = shellAfterFirstPoll(['Admin']).nativeElement as HTMLElement;

      expect(badge(root)).toBeNull();
      expect(ticketService.getAll).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    it('is read again as the operator moves between pages and every minute, so a resolved ticket leaves the count', fakeAsync(() => {
      openTickets = [{ id: 't1' }, { id: 't2' }];
      const fixture = shellAfterFirstPoll(['PlatformSuperAdmin']);
      expect(badge(fixture.nativeElement)?.textContent?.trim()).toBe('2');

      // One is resolved on the Tickets page; the next poll (and any page change) sees it.
      openTickets = [{ id: 't2' }];
      tick(60 * 1000);
      fixture.detectChanges();
      expect(badge(fixture.nativeElement)?.textContent?.trim()).toBe('1');

      openTickets = [];
      (fixture.componentInstance as unknown as { refreshOpenTickets(): void }).refreshOpenTickets();
      fixture.detectChanges();
      expect(badge(fixture.nativeElement)).toBeNull();
      discardPeriodicTasks();
    }));
  });

  it('shows no Tickets button to a tenant, who has no platform console', () => {
    const root = render(['Admin']);

    expect(root.querySelector('[data-testid=tickets-link]')).toBeNull();
  });

  it('still names the Tickets and Background Jobs pages in the toolbar, though neither is in the sidebar', () => {
    const fixture = createFixture(['PlatformSuperAdmin']);
    const heading = (url: string) => {
      // What the router's NavigationEnd hands the shell, without needing routes in a test module.
      (fixture.componentInstance as unknown as { updateHeading(url: string): void }).updateHeading(url);
      fixture.detectChanges();
      return {
        title: ((fixture.nativeElement as HTMLElement).querySelector('.toolbar-title')?.textContent ?? '').trim(),
        category: ((fixture.nativeElement as HTMLElement).querySelector('.toolbar-category')?.textContent ?? '').trim(),
      };
    };

    expect(heading('/platform/tickets')).toEqual({ title: 'Tickets', category: 'Support' });
    expect(heading('/platform/tickets?status=open')).toEqual({ title: 'Tickets', category: 'Support' });
    expect(heading('/platform/jobs')).toEqual({ title: 'Background Jobs', category: 'Infrastructure' });

    // A page that is in the sidebar keeps its own name.
    expect(heading('/platform/tenants/42')).toEqual({ title: 'Tenants', category: 'Tenants' });
  });

  describe('platform alerts bell', () => {
    const alert = (over: Partial<PlatformNotification>): PlatformNotification => ({
      id: 'a1', kind: 'JobFailing', severity: 'Critical', tenantId: 't1', tenantName: 'Acme',
      jobType: 'campaign-initial-sends', title: 'Campaign initial sends is failing for Acme', body: 'failed 3 runs',
      createdAt: '2026-09-19T10:00:00Z', acknowledged: false, ...over,
    });

    it('shows the operator only their unacknowledged job alerts', fakeAsync(() => {
      const fixture = createFixture(['PlatformSuperAdmin'], [alert({}), alert({ id: 'a2', acknowledged: true })]);
      tick(1); // the poll's first tick
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('[aria-label="Platform alerts"]')).not.toBeNull();
      expect(root.querySelector('.bell-count')?.textContent?.trim()).toBe('1');
      discardPeriodicTasks();
    }));

    it('links "More notifications" to the full Notifications screen once the bell has more than it can show', fakeAsync(() => {
      const many = Array.from({ length: 8 }, (_, i) => alert({ id: `a${i}`, title: `Alert ${i}` }));
      const fixture = createFixture(['PlatformSuperAdmin'], many);
      tick(1);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;

      (root.querySelector('[aria-label="Platform alerts"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      const more = Array.from(document.querySelectorAll('a.more-notifications'));
      expect(more.length).toBe(1);
      expect(more[0].getAttribute('href')).toBe('/notifications');
      expect(more[0].textContent).toContain('More notifications');
      // The bell shows the latest six; the rest are on the screen the link opens.
      expect(document.querySelectorAll('.alerts-menu .alert-row').length).toBe(6);
      flush();
      discardPeriodicTasks();
    }));

    it('opens each alert on the screen it is about, not always the jobs screen', fakeAsync(() => {
      const fixture = createFixture(['PlatformSuperAdmin'], [
        alert({ id: 'r1', kind: 'RefundRequested', title: 'Refund requested' }),
        alert({ id: 's1', kind: 'TenantSignedUp', tenantId: 't9', title: 'New signup: Acme' }),
        alert({ id: 'j1', title: 'Job failing' }),
      ]);
      tick(1);
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Platform alerts"]')!.click();
      fixture.detectChanges();

      const hrefOf = (title: string) =>
        Array.from(document.querySelectorAll('a.alert-item')).find((a) => a.textContent?.includes(title))?.getAttribute('href');
      expect(hrefOf('Refund requested')).toBe('/platform/refunds');
      expect(hrefOf('New signup: Acme')).toBe('/platform/tenants/t9');
      expect(hrefOf('Job failing')).toBe('/platform/jobs');
      flush();
      discardPeriodicTasks();
    }));

    it('has no "More notifications" link while everything fits in the bell', fakeAsync(() => {
      const fixture = createFixture(['PlatformSuperAdmin'], [alert({}), alert({ id: 'a2' })]);
      tick(1);
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Platform alerts"]')!.click();
      fixture.detectChanges();

      expect(document.querySelector('a.more-notifications')).toBeNull();
      flush();
      discardPeriodicTasks();
    }));

    it('is not shown to a tenant admin', () => {
      const root = render(['Admin']);

      expect(root.querySelector('[aria-label="Platform alerts"]')).toBeNull();
    });
  });
  describe('unconfirmed email banner', () => {
    const banner = (root: HTMLElement) => root.querySelector('.verify-banner');

    it('asks a user who has not confirmed their email to do so', () => {
      const fixture = createFixture(['Admin'], [], false);

      expect(banner(fixture.nativeElement)?.textContent).toContain('Confirm your email address');
    });

    it('stays out of the way of a confirmed user, and of an older cached session that has no flag', () => {
      expect(banner(createFixture(['Admin'], [], true).nativeElement)).toBeNull();
      TestBed.resetTestingModule();
      expect(banner(createFixture(['Admin'], [], undefined).nativeElement)).toBeNull();
    });

    it('resends the link and then says it was sent', () => {
      const resend = jasmine.createSpy('resend').and.returnValue(of(undefined));
      const fixture = createFixture(['Admin'], [], false, resend);

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.verify-banner button')!.click();
      fixture.detectChanges();

      expect(resend).toHaveBeenCalledTimes(1);
      expect(banner(fixture.nativeElement)?.textContent).toContain('Sent.');
      expect(banner(fixture.nativeElement)?.querySelector('button')).toBeNull();
    });
  });
});

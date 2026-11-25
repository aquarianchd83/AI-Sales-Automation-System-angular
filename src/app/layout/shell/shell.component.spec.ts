import { ComponentFixture, discardPeriodicTasks, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { NEVER, of } from 'rxjs';

import { AccountRecoveryService } from '../../core/services/account-recovery.service';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { LeadFollowUpService } from '../../core/services/lead-follow-up.service';
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
import { EntitlementsStore } from '../../core/services/entitlements.store';
import { PlatformFeature } from '../../core/models/wallet.model';
import { ShellComponent } from './shell.component';

describe('ShellComponent sidenav', () => {
  /** The tickets the operator would see as Open; a test sets it before building the shell. */
  let openTickets: unknown[] = [];
  let ticketService: { getAll: jasmine.Spy };
  /** Whether the platform has switched Content Studio on; a test sets it before building the shell. */
  let studioEnabled = false;
  let suggestedFollowUps = 0;

  beforeEach(() => {
    openTickets = [];
    studioEnabled = false;
    suggestedFollowUps = 0;
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
        { provide: ContentStudioService, useValue: { getStatus: () => of({ enabled: studioEnabled }) } },
        { provide: BillingService, useValue: { getNotifications: () => of([]) } },
        { provide: TenantProfileService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: PlatformNotificationService, useValue: { getRecent: () => of(platformAlerts) } },
        { provide: PlatformTicketService, useValue: ticketService },
        { provide: LeadFollowUpService, useValue: { getSummary: () => of({ scheduled: 0, dueNow: 0, dueWithin30Days: 0, sent: 0, suggested: suggestedFollowUps }) } },
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
      'event_repeatFollow-ups',
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

  describe('features the plan lacks', () => {
    /** Builds the shell, then lands the tenant's plan, as the entitlements call would. */
    const withPlan = (roles: string[], features: PlatformFeature[]): HTMLElement => {
      const fixture = createFixture(roles);
      TestBed.inject(EntitlementsStore).set({ planCode: 'basic', planName: 'Basic', features, balance: 10, costs: [] });
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };
    const BASIC: PlatformFeature[] = ['WhatsAppMessaging', 'AiConversations', 'Campaigns'];
    const link = (root: HTMLElement, label: string) =>
      Array.from(root.querySelectorAll<HTMLAnchorElement>('.nav-item')).find((a) => a.querySelector('.nav-item-label')?.textContent?.trim() === label);

    const trial = (feature: PlatformFeature, used: number) => ({
      feature, label: feature, freeUses: 10, used, remaining: Math.max(0, 10 - used), exhausted: used >= 10, unit: 'uses', unitSingular: 'use',
    });

    it('shows "used/allocated" on an entry open on free uses, and the free-trial bar on its pages', () => {
      const fixture = createFixture(['Admin']);
      TestBed.inject(EntitlementsStore).set({
        planCode: 'basic', planName: 'Basic', features: [...BASIC, 'LeadDiscovery', 'ProductKnowledge'], balance: 10, costs: [],
        trials: [trial('LeadDiscovery', 3), trial('ProductKnowledge', 1)],
      });
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;

      expect(link(root, 'Lead Discovery')!.querySelector('.nav-trial-chip')?.textContent?.trim()).toBe('3/10');
      // Knowledge is shared by two features; its chip still shows product knowledge's free uses.
      expect(link(root, 'Knowledge')!.querySelector('.nav-trial-chip')?.textContent?.trim()).toBe('1/10');

      spyOnProperty(TestBed.inject(Router), 'url', 'get').and.returnValue('/product-knowledge/sources');
      fixture.detectChanges();
      expect(root.querySelector('[data-testid="trial-bar"]')?.textContent).toContain('9 of 10 free uses left on your Basic plan');
    });

    it('keeps the entry open, read-only, once the free uses are gone: a full "10/10" chip, no lock', () => {
      const fixture = createFixture(['Admin']);
      TestBed.inject(EntitlementsStore).set({ planCode: 'basic', planName: 'Basic', features: BASIC, balance: 10, costs: [], trials: [trial('LeadDiscovery', 10)] });
      fixture.detectChanges();
      const lead = link(fixture.nativeElement as HTMLElement, 'Lead Discovery')!;

      expect(lead.querySelector('.nav-trial-chip')?.textContent?.trim()).toBe('10/10');
      expect(lead.classList).not.toContain('nav-item--locked');
      expect(lead.getAttribute('href')).toBe('/lead-discovery/history');
    });

    it('shows the customer limit beside Customers: "6/10", then "10/10"', () => {
      const fixture = createFixture(['Admin']);
      const store = TestBed.inject(EntitlementsStore);
      const quota = (used: number) => ({ key: 'Customers', label: 'Customers', limit: 10, used, remaining: Math.max(0, 10 - used), exhausted: used >= 10, unit: 'customers', unitSingular: 'customer' });
      store.set({ planCode: 'basic', planName: 'Basic', features: BASIC, balance: 10, costs: [], quotas: [quota(6)] });
      fixture.detectChanges();
      expect(link(fixture.nativeElement as HTMLElement, 'Customers')!.querySelector('.nav-trial-chip')?.textContent?.trim()).toBe('6/10');

      store.set({ planCode: 'basic', planName: 'Basic', features: BASIC, balance: 10, costs: [], quotas: [quota(10)] });
      fixture.detectChanges();
      expect(link(fixture.nativeElement as HTMLElement, 'Customers')!.querySelector('.nav-trial-chip')?.textContent?.trim()).toBe('10/10');
    });

    it('still lists a locked entry, dimmed, with a lock and a Premium chip, opening its preview', () => {
      const root = withPlan(['Admin'], BASIC);

      const lead = link(root, 'Lead Discovery')!;
      expect(lead).toBeDefined();
      expect(lead.classList).toContain('nav-item--locked');
      expect(lead.querySelector('.nav-lock')?.textContent?.trim()).toBe('lock');
      expect(lead.querySelector('.nav-premium-chip')?.textContent?.trim()).toBe('Premium');
      expect(lead.getAttribute('href')).toBe('/premium/lead-discovery');
      expect(lead.getAttribute('target')).toBeNull();
      expect(lead.getAttribute('aria-label')).toBe('Lead Discovery, Premium');
    });

    it('leaves the entries the plan includes exactly as they were', () => {
      const root = withPlan(['Admin'], BASIC);

      for (const [label, href] of [
        ['Customers', '/customers'],
        ['Message Templates', '/message-templates'],
        ['Campaigns', '/campaigns'],
        ['Inbox', '/conversations'],
      ]) {
        const a = link(root, label)!;
        expect(a.classList).not.toContain('nav-item--locked');
        expect(a.querySelector('.nav-premium-chip')).toBeNull();
        expect(a.querySelector('.nav-lock')).toBeNull();
        expect(a.getAttribute('href')).toBe(href);
      }
    });

    it('locks nothing on a plan that includes every feature, or before the plan is known', () => {
      const all = withPlan(['Admin'], ['WhatsAppMessaging', 'AiConversations', 'LeadDiscovery', 'ContentStudio', 'ProductKnowledge', 'Campaigns']);
      expect(all.querySelector('.nav-item--locked')).toBeNull();
      expect(link(all, 'Lead Discovery')!.getAttribute('href')).toBe('/lead-discovery/history');

      TestBed.resetTestingModule();
      expect(render(['Admin']).querySelector('.nav-item--locked')).toBeNull();
    });

    it('locks messaging entries for a plan without WhatsApp messaging', () => {
      const root = withPlan(['Admin'], ['AiConversations']);

      expect(link(root, 'Campaigns')!.getAttribute('href')).toBe('/premium/campaigns');
      expect(link(root, 'Message Templates')!.classList).toContain('nav-item--locked');
    });

    it("shows an Admin's Knowledge entry locked on product knowledge when neither knowledge feature is in the plan", () => {
      const root = withPlan(['Admin'], BASIC);

      const knowledge = link(root, 'Knowledge')!;
      expect(knowledge.classList).toContain('nav-item--locked');
      expect(knowledge.getAttribute('href')).toBe('/premium/product-knowledge');
    });

    it('opens Knowledge on the studio for an Admin whose plan has the studio but not product knowledge', () => {
      studioEnabled = true;
      const root = withPlan(['Admin'], [...BASIC, 'ContentStudio']);

      const knowledge = link(root, 'Knowledge')!;
      expect(knowledge.classList).not.toContain('nav-item--locked');
      expect(knowledge.getAttribute('href')).toBe('/content-studio/questionnaire');
    });

    it('still respects the module switch: a locked studio entry shows only once the platform switches the studio on', () => {
      expect(link(withPlan(['Admin'], BASIC), 'Story Studio')).toBeUndefined();

      TestBed.resetTestingModule();
      studioEnabled = true;
      const story = link(withPlan(['Admin'], BASIC), 'Story Studio')!;
      expect(story.classList).toContain('nav-item--locked');
      expect(story.getAttribute('href')).toBe('/premium/content-studio');
    });

    it('still respects roles: a sales agent sees locked entries open to them, and none of the admin-only ones', () => {
      studioEnabled = true;
      const root = withPlan(['SalesAgent'], BASIC);

      expect(link(root, 'Lead Discovery')!.getAttribute('href')).toBe('/premium/lead-discovery');
      expect(link(root, 'Story Studio')).toBeUndefined();
      expect(link(root, 'Charges & Activity')).toBeUndefined();
      expect(link(root, 'Knowledge')).toBeUndefined();
      expect(labels(root)).toEqual(['Outreach', 'Engage', 'Extra']);
    });

    it('shows a Sales Manager the studio entries locked, landing on the studio preview', () => {
      studioEnabled = true;
      const root = withPlan(['SalesManager'], BASIC);

      expect(link(root, 'Knowledge')!.getAttribute('href')).toBe('/premium/content-studio');
      expect(link(root, 'Story Studio')!.getAttribute('href')).toBe('/premium/content-studio');
      expect(link(root, 'Charges & Activity')).toBeUndefined();
    });
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
    expect(items(root).length).toBe(12);
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
      'movieVideo Requests',
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
      'toggle_onFeatures',
      'hubIntegrations',
      'scienceRazorpay',
      'ads_clickMeta Ads',
      'receipt_longLogs',
      'historyAudit Log',
      'storageDatabase Size',
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

  it('shows nothing beside Follow-ups while no AI suggestion is waiting', () => {
    const root = render(['Admin']);

    expect(root.querySelector('[data-testid="nav-approve-/follow-ups"]')).toBeNull();
  });

  it('shows how many AI follow-up suggestions are waiting beside Follow-ups', () => {
    suggestedFollowUps = 2;
    const root = render(['Admin']);

    expect(root.querySelector('[data-testid="nav-approve-/follow-ups"]')?.textContent?.trim()).toBe('2 to approve');
  });
});

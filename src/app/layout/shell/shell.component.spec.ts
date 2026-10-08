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
import { NotificationHubService } from '../../core/services/notification-hub.service';
import { PlatformNotification } from '../../core/models/platform.model';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './shell.component';

describe('ShellComponent sidenav', () => {
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
        { provide: BillingService, useValue: { getNotifications: () => of([]) } },
        { provide: TenantProfileService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: PlatformNotificationService, useValue: { getRecent: () => of(platformAlerts) } },
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

    expect(labels(root)).toEqual(['Engage', 'CRM', 'Content', 'Workspace']);
    expect(items(root)).toEqual([
      'dashboardDashboard',
      'inboxInbox',
      'support_agentHandoffs',
      'campaignCampaigns',
      'groupsCustomers',
      'insightsLeads',
      'travel_exploreLead Discovery',
      'sellTags',
      'inventory_2Packages',
      'text_snippetMessage Templates',
      'perm_mediaMedia Library',
      'menu_bookKnowledge Base',
      'bar_chartReports',
      'monitoringAgent Performance',
      'storefrontBusiness Profile',
      'publicSocial Ads',
      'manage_accountsUsers & Roles',
      'settingsSettings',
      'historyAudit Log',
      'paymentsBilling',
      'data_usageUsage & Credits',
      'scienceTest Notifications',
    ]);
  });

  it('drops the whole Workspace section for a sales agent', () => {
    const root = render(['SalesAgent']);

    expect(labels(root)).toEqual(['Engage', 'CRM', 'Content']);
    expect(items(root)).not.toContain('settingsSettings');
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
      'menu_bookKnowledge Base',
      'paymentsPackage',
      'data_usageUsage & Quotas',
      'receipt_longPayments',
      'assignment_returnRefund Requests',
      'chatPlatform WhatsApp',
      'descriptionNotice Templates',
      'perm_mediaNotice Media',
      'cloud_syncWhatsApp Connections',
      'scheduleBackground Jobs',
      'tuneGeneral',
      'smart_toyAI Providers',
      'tuneTenant Settings',
      'cloudAWS Settings',
      'forward_to_inboxSMTP/SMS Settings',
      'scienceRazorpay Test',
      'request_quoteAI Provider Charges',
      'ads_clickMeta Ads',
      'settingsSystem',
      'receipt_longLogs',
      'historyAudit Log',
      'account_circleMy Profile',
    ]);
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

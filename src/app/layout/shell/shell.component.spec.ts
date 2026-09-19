import { ComponentFixture, discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { PlatformNotification } from '../../core/models/platform.model';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './shell.component';

describe('ShellComponent sidenav', () => {
  function createFixture(roles: string[], platformAlerts: PlatformNotification[] = []): ComponentFixture<ShellComponent> {
    const auth = {
      currentUser$: of({ fullName: 'Test User', email: 't@example.com', roles }),
      isImpersonating: false,
      hasAnyRole: (wanted: string[]) =>
        wanted.length === 0 || wanted.some((role) => roles.includes(role)),
    };

    TestBed.configureTestingModule({
      declarations: [ShellComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AnnouncementService, useValue: { getActive: () => of([]) } },
        { provide: AccountService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: BillingService, useValue: { getNotifications: () => of([]) } },
        { provide: PlatformNotificationService, useValue: { getRecent: () => of(platformAlerts) } },
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
      'text_snippetMessage Templates',
      'perm_mediaMedia Library',
      'menu_bookKnowledge Base',
      'storefrontBusiness Profile',
      'manage_accountsUsers & Roles',
      'settingsSettings',
      'paymentsBilling',
      'data_usageUsage & Credits',
    ]);
  });

  it('drops the whole Workspace section for a sales agent', () => {
    const root = render(['SalesAgent']);

    expect(labels(root)).toEqual(['Engage', 'CRM', 'Content']);
    expect(items(root)).not.toContain('settingsSettings');
    expect(items(root).length).toBe(11);
  });

  it('groups the platform console nav the same way, with no tenant items', () => {
    const root = render(['PlatformSuperAdmin']);

    expect(labels(root)).toEqual(['Tenants', 'Revenue', 'Infrastructure', 'Monitoring', 'Account']);
    expect(items(root)).toEqual([
      'dashboardDashboard',
      'businessTenants',
      'manage_accountsUsers',
      'campaignAnnouncements',
      'paymentsPackage',
      'data_usageUsage & Quotas',
      'receipt_longPayments',
      'assignment_returnRefund Requests',
      'tuneConfiguration',
      'cloud_syncWhatsApp Connections',
      'scheduleBackground Jobs',
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

    it('is not shown to a tenant admin', () => {
      const root = render(['Admin']);

      expect(root.querySelector('[aria-label="Platform alerts"]')).toBeNull();
    });
  });
});

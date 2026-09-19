import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './shell.component';

describe('ShellComponent sidenav', () => {
  function render(roles: string[]): HTMLElement {
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
      ],
    });

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

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
});

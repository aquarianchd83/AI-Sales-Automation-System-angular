import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, of } from 'rxjs';

import { AccountRecoveryService } from '../../core/services/account-recovery.service';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { ContentStudioService } from '../../core/services/content-studio.service';
import { EntitlementsStore } from '../../core/services/entitlements.store';
import { NotificationHubService } from '../../core/services/notification-hub.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { PlatformWalletService } from '../../core/services/platform-wallet.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './shell.component';

describe('ShellComponent wallet balance', () => {
  function render(roles: string[], balance: number | null, platformBalance = 0): HTMLElement {
    return renderWithFixture(roles, balance, platformBalance).root;
  }

  function renderWithFixture(roles: string[], balance: number | null, platformBalance = 0) {
    const auth = {
      currentUser$: of({ fullName: 'Test User', email: 't@example.com', roles }),
      isImpersonating: false,
      hasAnyRole: (wanted: string[]) => wanted.length === 0 || wanted.some((role) => roles.includes(role)),
    };
    TestBed.configureTestingModule({
      declarations: [ShellComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OnboardingService, useValue: { status$: of(null), refresh: () => of(null), current: () => of(null) } },
        { provide: AnnouncementService, useValue: { getActive: () => of([]) } },
        { provide: AccountRecoveryService, useValue: { resendVerificationEmail: () => of(undefined) } },
        { provide: AccountService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: ContentStudioService, useValue: { getStatus: () => of({ enabled: false }) } },
        { provide: BillingService, useValue: { getNotifications: () => of([]), getEntitlements: () => of(null) } },
        { provide: PlatformNotificationService, useValue: { getRecent: () => of([]) } },
        { provide: PlatformWalletService, useValue: { summary$: of({ balance: platformBalance, topUpCount: 1, lastTopUpDate: '2026-10-23' }), refresh: () => undefined } },
        { provide: TenantProfileService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: NotificationHubService, useValue: { connect: () => undefined, disconnect: () => undefined, notificationReceived$: NEVER } },
      ],
    });
    if (balance !== null) {
      TestBed.inject(EntitlementsStore).set({ planCode: 'premium', planName: 'Premium', features: [], balance, costs: [] });
    }
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, fixture };
  }

  const chip = (root: HTMLElement) => root.querySelector('.wallet-chip');
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows the credits left beside the bell, as a button that opens a menu with the spend credit history', () => {
    const { root, fixture } = renderWithFixture(['Admin'], 1234.5);

    expect(text(chip(root))).toContain('1,234.5');
    (chip(root) as HTMLButtonElement).click();
    fixture.detectChanges();

    const items = Array.from(document.querySelectorAll('.mat-mdc-menu-panel a')).map((e) => ({ label: text(e), href: e.getAttribute('href') }));
    expect(items.map((i) => i.label)).toEqual(['historySpend credit history', 'data_usageUsage & credits']);
    expect(items[0].href).toBe('/billing/credit-usage');
  });

  it('still shows a balance of zero', () => {
    expect(text(chip(render(['Admin'], 0)))).toContain('0');
  });

  it('shows it as plain text for a user who cannot open the wallet page', () => {
    const chipEl = chip(render(['SalesAgent'], 80));

    expect(text(chipEl)).toContain('80');
    expect(chipEl?.getAttribute('href')).toBeNull();
  });

  it('shows nothing until the balance is known, and never for a platform admin', () => {
    expect(chip(render(['Admin'], null))).toBeNull();
  });

  it('shows a platform admin the platform wallet in rupees, with a menu for the credit history and adding credit', () => {
    const { root, fixture } = renderWithFixture(['PlatformSuperAdmin'], null, 2500);

    expect(text(chip(root))).toContain('₹2,500');
    (chip(root) as HTMLButtonElement).click();
    fixture.detectChanges();

    const items = Array.from(document.querySelectorAll('.mat-mdc-menu-panel a, .mat-mdc-menu-panel button')).map((e) => ({ label: text(e), href: e.getAttribute('href') }));
    expect(items.map((i) => i.label)).toEqual(['historyCredit history', 'add_cardAdd credit']);
    expect(items[0].href).toBe('/platform/wallet');
  });

  it('never shows a tenant the platform wallet', () => {
    expect(text(chip(render(['Admin'], 80, 9999)))).not.toContain('9,999');
  });
});

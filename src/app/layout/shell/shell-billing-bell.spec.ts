import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { QuotaType, TenantNotification, TenantNotificationKind } from '../../core/models/billing.model';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './shell.component';

const alert = (id: string, kind: TenantNotificationKind, acknowledged = false): TenantNotification => ({
  id,
  kind,
  quotaType: QuotaType.WhatsAppMessages,
  title: `alert ${id}`,
  body: 'body',
  emailStatus: 1,
  whatsAppStatus: 1,
  createdAt: '2026-09-19T00:00:00Z',
  acknowledged,
});

describe('ShellComponent billing bell', () => {
  function render(options: { roles: string[]; impersonating?: boolean; notifications?: TenantNotification[] }) {
    const getNotifications = jasmine.createSpy('getNotifications').and.returnValue(of(options.notifications ?? []));
    const auth = {
      currentUser$: of({ fullName: 'Test User', email: 't@example.com', roles: options.roles }),
      isImpersonating: options.impersonating ?? false,
      hasAnyRole: (wanted: string[]) => wanted.length === 0 || wanted.some((role) => options.roles.includes(role)),
    };

    TestBed.configureTestingModule({
      declarations: [ShellComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AnnouncementService, useValue: { getActive: () => of([]) } },
        { provide: AccountService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: BillingService, useValue: { getNotifications } },
        { provide: PlatformNotificationService, useValue: { getRecent: () => of([]) } },
      ],
    });

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    tick(1); // the poll's first tick
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, getNotifications };
  }

  it('shows a tenant admin how many billing alerts are unread', fakeAsync(() => {
    const { root, fixture } = render({
      roles: ['Admin'],
      notifications: [
        alert('1', TenantNotificationKind.QuotaLow20),
        alert('2', TenantNotificationKind.QuotaExhausted),
        alert('3', TenantNotificationKind.CreditsExpiring14, true), // already read - not counted
      ],
    });

    expect(root.querySelector('.bell')).not.toBeNull();
    expect(root.querySelector('.bell-count')?.textContent?.trim()).toBe('2');
    expect(fixture.componentInstance.billingAlerts.map((a) => a.id)).toEqual(['1', '2']);
    expect(root.querySelector('.bell mat-icon')?.textContent?.trim()).toBe('notifications_active');
    discardPeriodicTasks();
  }));

  it('is quiet when there is nothing unread', fakeAsync(() => {
    const { root } = render({ roles: ['Admin'], notifications: [] });

    expect(root.querySelector('.bell-count')).toBeNull();
    expect(root.querySelector('.bell mat-icon')?.textContent?.trim()).toBe('notifications_none');
    discardPeriodicTasks();
  }));

  it('flags the alerts that mean something has stopped or is about to', fakeAsync(() => {
    const { fixture } = render({ roles: ['Admin'], notifications: [] });
    const component = fixture.componentInstance;

    expect(component.urgentAlert(alert('a', TenantNotificationKind.QuotaExhausted))).toBeTrue();
    expect(component.urgentAlert(alert('b', TenantNotificationKind.QuotaLow5))).toBeTrue();
    expect(component.urgentAlert(alert('c', TenantNotificationKind.CreditsExpiring3))).toBeTrue();
    expect(component.urgentAlert(alert('d', TenantNotificationKind.QuotaLow20))).toBeFalse();
    discardPeriodicTasks();
  }));

  it('shows a plan-expiry notice to the tenant, counted like any other alert, urgent the day before', fakeAsync(() => {
    const { root, fixture } = render({
      roles: ['Admin'],
      notifications: [
        { ...alert('p7', TenantNotificationKind.PlanExpiring7), quotaType: null, title: 'Your Silver plan renews in 7 days' },
        { ...alert('p1', TenantNotificationKind.PlanExpiring1), quotaType: null, title: 'Your Silver plan renews tomorrow' },
      ],
    });

    expect(root.querySelector('.bell-count')?.textContent?.trim()).toBe('2');
    const [week, day] = fixture.componentInstance.billingAlerts;
    expect(week.title).toBe('Your Silver plan renews in 7 days');
    expect(fixture.componentInstance.urgentAlert(week)).toBeFalse();
    expect(fixture.componentInstance.urgentAlert(day)).toBeTrue();
    discardPeriodicTasks();
  }));

  it('never appears for the platform operator, and never even asks the API', fakeAsync(() => {
    const { root, getNotifications } = render({ roles: ['PlatformSuperAdmin'], notifications: [alert('1', TenantNotificationKind.QuotaLow20)] });

    expect(root.querySelector('[aria-label="Billing alerts"]')).toBeNull();
    expect(getNotifications).not.toHaveBeenCalled();
    discardPeriodicTasks(); // the operator's own platform-alerts poll
  }));

  it('never appears in a support session, so looking at a tenant cannot mark its alerts read', fakeAsync(() => {
    const { root, getNotifications } = render({ roles: ['Admin'], impersonating: true, notifications: [alert('1', TenantNotificationKind.QuotaLow20)] });

    expect(root.querySelector('.bell')).toBeNull();
    expect(getNotifications).not.toHaveBeenCalled();
  }));

  it('is not offered to a sales agent, who cannot read billing', fakeAsync(() => {
    const { root, getNotifications } = render({ roles: ['SalesAgent'] });

    expect(root.querySelector('.bell')).toBeNull();
    expect(getNotifications).not.toHaveBeenCalled();
  }));
});

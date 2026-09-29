import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, of, Subject } from 'rxjs';

import { QuotaType, TenantNotification, TenantNotificationKind } from '../../core/models/billing.model';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { NotificationHubService } from '../../core/services/notification-hub.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
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
  function render(options: {
    roles: string[];
    impersonating?: boolean;
    notifications?: TenantNotification[];
    liveNotifications$?: Subject<unknown>;
  }) {
    const getNotifications = jasmine.createSpy('getNotifications').and.returnValue(of(options.notifications ?? []));
    const acknowledgeNotification = jasmine.createSpy('acknowledgeNotification').and.returnValue(of(undefined));
    const acknowledgeAllNotifications = jasmine.createSpy('acknowledgeAllNotifications').and.returnValue(of(undefined));
    const deleteNotification = jasmine.createSpy('deleteNotification').and.returnValue(of(undefined));
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
        { provide: BillingService, useValue: { getNotifications, acknowledgeNotification, acknowledgeAllNotifications, deleteNotification } },
        { provide: PlatformNotificationService, useValue: { getRecent: () => of([]) } },
        { provide: TenantProfileService, useValue: { getProfile: () => of({ timezone: 'America/New_York' }) } },
        {
          provide: NotificationHubService,
          useValue: {
            connect: () => undefined,
            disconnect: () => undefined,
            notificationReceived$: options.liveNotifications$ ?? NEVER,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    tick(1); // the poll's first tick
    fixture.detectChanges();
    return {
      fixture,
      root: fixture.nativeElement as HTMLElement,
      getNotifications,
      acknowledgeNotification,
      acknowledgeAllNotifications,
      deleteNotification,
    };
  }

  /** The bell's list lives in a CDK overlay portal attached to the document body, not under the
   * component's own root element - opening the trigger renders it (NoopAnimationsModule makes this
   * synchronous). */
  function openMenu(root: HTMLElement, fixture: { detectChanges: () => void }): HTMLElement {
    root.querySelector<HTMLButtonElement>('[aria-label="Billing alerts"]')!.click();
    fixture.detectChanges();
    tick(500); // CDK overlay schedules a one-off timer (focus/backdrop setup) opening the panel
    return document.querySelector('.cdk-overlay-container') as HTMLElement;
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
    expect(fixture.componentInstance.billingAlerts.map((a) => a.id)).toEqual(['1', '2', '3']);
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

  it('marks one alert read without touching the others', fakeAsync(() => {
    const { fixture, acknowledgeNotification } = render({
      roles: ['Admin'],
      notifications: [alert('1', TenantNotificationKind.QuotaLow20), alert('2', TenantNotificationKind.QuotaExhausted)],
    });

    fixture.componentInstance.acknowledgeBillingAlert(alert('1', TenantNotificationKind.QuotaLow20));

    expect(acknowledgeNotification).toHaveBeenCalledWith('1');
    expect(fixture.componentInstance.billingAlerts.map((a) => [a.id, a.acknowledged])).toEqual([
      ['1', true],
      ['2', false],
    ]);
    expect(fixture.componentInstance.unreadBillingCount).toBe(1);
    discardPeriodicTasks();
  }));

  it('lists the newest notification first, with its date and time', fakeAsync(() => {
    const { root, fixture } = render({
      roles: ['Admin'],
      notifications: [
        { ...alert('old', TenantNotificationKind.QuotaLow20), createdAt: '2026-09-18T00:00:00Z' },
        { ...alert('new', TenantNotificationKind.QuotaLow20), createdAt: '2026-09-20T00:00:00Z' },
      ],
    });

    expect(fixture.componentInstance.billingAlerts.map((a) => a.id)).toEqual(['new', 'old']);
    const overlay = openMenu(root, fixture);
    expect(overlay.querySelectorAll('.alert-time').length).toBe(2);
    discardPeriodicTasks();
  }));

  it('greys out a read notification and keeps an unread one bold', fakeAsync(() => {
    const { root, fixture } = render({
      roles: ['Admin'],
      notifications: [alert('1', TenantNotificationKind.QuotaLow20), alert('2', TenantNotificationKind.QuotaLow20, true)],
    });

    const overlay = openMenu(root, fixture);

    expect(overlay.querySelectorAll('.alert-item--read').length).toBe(1);
    expect(overlay.querySelectorAll('.alert-row').length).toBe(2);
    discardPeriodicTasks();
  }));

  it('marks every alert read at once but keeps them in the list', fakeAsync(() => {
    const { fixture, acknowledgeAllNotifications } = render({
      roles: ['Admin'],
      notifications: [alert('1', TenantNotificationKind.QuotaLow20), alert('2', TenantNotificationKind.QuotaExhausted)],
    });

    fixture.componentInstance.acknowledgeAllBillingAlerts();

    expect(acknowledgeAllNotifications).toHaveBeenCalled();
    expect(fixture.componentInstance.billingAlerts.length).toBe(2);
    expect(fixture.componentInstance.unreadBillingCount).toBe(0);
    discardPeriodicTasks();
  }));

  it('deletes one alert without touching the others', fakeAsync(() => {
    const { fixture, deleteNotification } = render({
      roles: ['Admin'],
      notifications: [alert('1', TenantNotificationKind.QuotaLow20), alert('2', TenantNotificationKind.QuotaExhausted)],
    });

    fixture.componentInstance.deleteBillingAlert(alert('1', TenantNotificationKind.QuotaLow20));

    expect(deleteNotification).toHaveBeenCalledWith('1');
    expect(fixture.componentInstance.billingAlerts.map((a) => a.id)).toEqual(['2']);
    discardPeriodicTasks();
  }));

  describe('urgent alert banner', () => {
    it('shows a banner on the page itself for an urgent alert, not just the bell', fakeAsync(() => {
      const { root } = render({
        roles: ['Admin'],
        notifications: [{ ...alert('1', TenantNotificationKind.QuotaExhausted), title: "You've used all your lead candidates" }],
      });

      const banner = root.querySelector('.billing-alert-banner');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain("You've used all your lead candidates");
      expect(banner?.querySelector('a[href="/billing/wallet"]')).not.toBeNull();
      discardPeriodicTasks();
    }));

    it('does not banner a non-urgent alert - the bell alone is enough for that', fakeAsync(() => {
      const { root } = render({ roles: ['Admin'], notifications: [alert('1', TenantNotificationKind.QuotaLow20)] });

      expect(root.querySelector('.billing-alert-banner')).toBeNull();
      discardPeriodicTasks();
    }));

    it('stacks one banner per urgent alert until each is dismissed', fakeAsync(() => {
      const { root } = render({
        roles: ['Admin'],
        notifications: [alert('1', TenantNotificationKind.QuotaExhausted), alert('2', TenantNotificationKind.QuotaLow5)],
      });

      expect(root.querySelectorAll('.billing-alert-banner').length).toBe(2);
      discardPeriodicTasks();
    }));

    it('the banner\'s own dismiss button acknowledges just that alert and it disappears', fakeAsync(() => {
      const { root, fixture, acknowledgeNotification } = render({
        roles: ['Admin'],
        notifications: [alert('1', TenantNotificationKind.QuotaExhausted), alert('2', TenantNotificationKind.QuotaLow5)],
      });

      root.querySelector<HTMLButtonElement>('.billing-alert-banner button[aria-label="Dismiss"]')!.click();
      fixture.detectChanges();

      expect(acknowledgeNotification).toHaveBeenCalledWith('1');
      expect(root.querySelectorAll('.billing-alert-banner').length).toBe(1);
      discardPeriodicTasks();
    }));
  });

  describe('panel size and the More notifications button', () => {
    it('shows at most 6 notifications, with a More notifications button once there are more', fakeAsync(() => {
      const notifications = Array.from({ length: 8 }, (_, i) => alert(String(i + 1), TenantNotificationKind.QuotaLow20));
      const { root, fixture } = render({ roles: ['Admin'], notifications });

      const overlay = openMenu(root, fixture);

      expect(overlay.querySelectorAll('.alert-row').length).toBe(6);
      expect(overlay.querySelector('.more-notifications')).not.toBeNull();
      discardPeriodicTasks();
    }));

    it('hides the More notifications button when 6 or fewer are unread', fakeAsync(() => {
      const notifications = Array.from({ length: 3 }, (_, i) => alert(String(i + 1), TenantNotificationKind.QuotaLow20));
      const { root, fixture } = render({ roles: ['Admin'], notifications });

      const overlay = openMenu(root, fixture);

      expect(overlay.querySelectorAll('.alert-row').length).toBe(3);
      expect(overlay.querySelector('.more-notifications')).toBeNull();
      discardPeriodicTasks();
    }));
  });

  describe('live push', () => {
    it('prepends a notification pushed over the live channel without waiting for the next poll', fakeAsync(() => {
      const live$ = new Subject<unknown>();
      const { fixture } = render({ roles: ['Admin'], notifications: [alert('1', TenantNotificationKind.QuotaLow20)], liveNotifications$: live$ });

      live$.next(alert('2', TenantNotificationKind.QuotaExhausted));
      fixture.detectChanges();

      expect(fixture.componentInstance.billingAlerts.map((a) => a.id)).toEqual(['2', '1']);
      discardPeriodicTasks();
    }));

    it('never double-adds a push for a notification the poll already has', fakeAsync(() => {
      const live$ = new Subject<unknown>();
      const { fixture } = render({ roles: ['Admin'], notifications: [alert('1', TenantNotificationKind.QuotaLow20)], liveNotifications$: live$ });

      live$.next(alert('1', TenantNotificationKind.QuotaLow20));
      fixture.detectChanges();

      expect(fixture.componentInstance.billingAlerts.map((a) => a.id)).toEqual(['1']);
      discardPeriodicTasks();
    }));

    it('keeps a push that arrives already acknowledged, but does not count it as unread', fakeAsync(() => {
      const live$ = new Subject<unknown>();
      const { fixture } = render({ roles: ['Admin'], notifications: [], liveNotifications$: live$ });

      live$.next(alert('1', TenantNotificationKind.QuotaLow20, true));
      fixture.detectChanges();

      expect(fixture.componentInstance.billingAlerts.length).toBe(1);
      expect(fixture.componentInstance.unreadBillingCount).toBe(0);
      discardPeriodicTasks();
    }));
  });
});

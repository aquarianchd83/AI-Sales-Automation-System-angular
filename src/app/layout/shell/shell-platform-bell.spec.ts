import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, of, Subject } from 'rxjs';

import { PlatformNotification } from '../../core/models/platform.model';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { NotificationHubService } from '../../core/services/notification-hub.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './shell.component';

const alert = (id: string, acknowledged = false): PlatformNotification => ({
  id,
  kind: 'JobFailing',
  severity: 'Critical',
  tenantId: null,
  tenantName: null,
  jobType: 'CampaignInitialSends',
  title: `alert ${id}`,
  body: 'body',
  createdAt: '2026-09-19T00:00:00Z',
  acknowledged,
});

describe('ShellComponent platform bell', () => {
  function render(notifications: PlatformNotification[] = [], liveNotifications$?: Subject<unknown>) {
    const getRecent = jasmine.createSpy('getRecent').and.returnValue(of(notifications));
    const acknowledge = jasmine.createSpy('acknowledge').and.returnValue(of(undefined));
    const acknowledgeAll = jasmine.createSpy('acknowledgeAll').and.returnValue(of(undefined));
    const deleteSpy = jasmine.createSpy('delete').and.returnValue(of(undefined));
    const auth = {
      currentUser$: of({ fullName: 'Test User', email: 't@example.com', roles: ['PlatformSuperAdmin'] }),
      isImpersonating: false,
      hasAnyRole: (wanted: string[]) => wanted.length === 0 || wanted.some((role) => role === 'PlatformSuperAdmin'),
    };

    TestBed.configureTestingModule({
      declarations: [ShellComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AnnouncementService, useValue: { getActive: () => of([]) } },
        { provide: AccountService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: BillingService, useValue: { getNotifications: () => of([]) } },
        { provide: TenantProfileService, useValue: { getProfile: () => of({ timezone: 'Asia/Kolkata' }) } },
        { provide: PlatformNotificationService, useValue: { getRecent, acknowledge, acknowledgeAll, delete: deleteSpy } },
        {
          provide: NotificationHubService,
          useValue: { connect: () => undefined, disconnect: () => undefined, notificationReceived$: liveNotifications$ ?? NEVER },
        },
      ],
    });

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    tick(1); // the poll's first tick
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, getRecent, acknowledge, acknowledgeAll, deleteSpy };
  }

  function openMenu(root: HTMLElement, fixture: { detectChanges: () => void }): HTMLElement {
    root.querySelector<HTMLButtonElement>('[aria-label="Platform alerts"]')!.click();
    fixture.detectChanges();
    tick(500); // CDK overlay schedules a one-off timer (focus/backdrop setup) opening the panel
    return document.querySelector('.cdk-overlay-container') as HTMLElement;
  }

  it('shows the operator how many platform alerts are unread', fakeAsync(() => {
    const { root, fixture } = render([alert('1'), alert('2'), alert('3', true)]);

    expect(root.querySelector('.bell-count')?.textContent?.trim()).toBe('2');
    expect(fixture.componentInstance.platformAlerts.map((a) => a.id)).toEqual(['1', '2', '3']);
    discardPeriodicTasks();
  }));

  it('lists the newest notification first, with its date and time', fakeAsync(() => {
    const { root, fixture } = render([
      { ...alert('old'), createdAt: '2026-09-18T00:00:00Z' },
      { ...alert('new'), createdAt: '2026-09-20T00:00:00Z' },
    ]);

    expect(fixture.componentInstance.platformAlerts.map((a) => a.id)).toEqual(['new', 'old']);
    const overlay = openMenu(root, fixture);
    expect(overlay.querySelectorAll('.alert-time').length).toBe(2);
    discardPeriodicTasks();
  }));

  it('greys out a read notification and keeps an unread one bold', fakeAsync(() => {
    const { root, fixture } = render([alert('1'), alert('2', true)]);

    const overlay = openMenu(root, fixture);

    expect(overlay.querySelectorAll('.alert-item--read').length).toBe(1);
    expect(overlay.querySelectorAll('.alert-row').length).toBe(2);
    discardPeriodicTasks();
  }));

  it('marks one alert read on open but keeps it in the list', fakeAsync(() => {
    const { fixture, acknowledge } = render([alert('1'), alert('2')]);

    fixture.componentInstance.openPlatformAlert(alert('1'));

    expect(acknowledge).toHaveBeenCalledWith('1');
    expect(fixture.componentInstance.platformAlerts.map((a) => [a.id, a.acknowledged])).toEqual([
      ['1', true],
      ['2', false],
    ]);
    expect(fixture.componentInstance.unreadPlatformCount).toBe(1);
    discardPeriodicTasks();
  }));

  it('marks every alert read at once but keeps them in the list', fakeAsync(() => {
    const { fixture, acknowledgeAll } = render([alert('1'), alert('2')]);

    fixture.componentInstance.acknowledgeAllPlatformAlerts();

    expect(acknowledgeAll).toHaveBeenCalled();
    expect(fixture.componentInstance.platformAlerts.length).toBe(2);
    expect(fixture.componentInstance.unreadPlatformCount).toBe(0);
    discardPeriodicTasks();
  }));

  it('deletes one alert without touching the others', fakeAsync(() => {
    const { fixture, deleteSpy } = render([alert('1'), alert('2')]);

    fixture.componentInstance.deletePlatformAlert(alert('1'));

    expect(deleteSpy).toHaveBeenCalledWith('1');
    expect(fixture.componentInstance.platformAlerts.map((a) => a.id)).toEqual(['2']);
    discardPeriodicTasks();
  }));

  it('shows at most 6 notifications, with a More notifications button once there are more', fakeAsync(() => {
    const notifications = Array.from({ length: 8 }, (_, i) => alert(String(i + 1)));
    const { root, fixture } = render(notifications);

    const overlay = openMenu(root, fixture);

    expect(overlay.querySelectorAll('.alert-row').length).toBe(6);
    expect(overlay.querySelector('.more-notifications')).not.toBeNull();
    discardPeriodicTasks();
  }));

  it('hides the More notifications button when 6 or fewer are unread', fakeAsync(() => {
    const notifications = Array.from({ length: 3 }, (_, i) => alert(String(i + 1)));
    const { root, fixture } = render(notifications);

    const overlay = openMenu(root, fixture);

    expect(overlay.querySelectorAll('.alert-row').length).toBe(3);
    expect(overlay.querySelector('.more-notifications')).toBeNull();
    discardPeriodicTasks();
  }));

  it('prepends a notification pushed over the live channel without waiting for the next poll', fakeAsync(() => {
    const live$ = new Subject<unknown>();
    const { fixture } = render([alert('1')], live$);

    live$.next(alert('2'));
    fixture.detectChanges();

    expect(fixture.componentInstance.platformAlerts.map((a) => a.id)).toEqual(['2', '1']);
    discardPeriodicTasks();
  }));
});

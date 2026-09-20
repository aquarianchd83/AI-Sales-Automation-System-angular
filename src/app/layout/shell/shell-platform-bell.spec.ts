import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformNotification } from '../../core/models/platform.model';
import { AccountService } from '../../core/services/account.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
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
  function render(notifications: PlatformNotification[] = []) {
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
        { provide: PlatformNotificationService, useValue: { getRecent, acknowledge, acknowledgeAll, delete: deleteSpy } },
      ],
    });

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    tick(1); // the poll's first tick
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, getRecent, acknowledge, acknowledgeAll, deleteSpy };
  }

  it('shows the operator how many platform alerts are unread', fakeAsync(() => {
    const { root, fixture } = render([alert('1'), alert('2'), alert('3', true)]);

    expect(root.querySelector('.bell-count')?.textContent?.trim()).toBe('2');
    expect(fixture.componentInstance.platformAlerts.map((a) => a.id)).toEqual(['1', '2']);
    discardPeriodicTasks();
  }));

  it('acknowledges one alert on open without touching the others', fakeAsync(() => {
    const { fixture, acknowledge } = render([alert('1'), alert('2')]);

    fixture.componentInstance.openPlatformAlert(alert('1'));

    expect(acknowledge).toHaveBeenCalledWith('1');
    expect(fixture.componentInstance.platformAlerts.map((a) => a.id)).toEqual(['2']);
    discardPeriodicTasks();
  }));

  it('clears every unread alert at once', fakeAsync(() => {
    const { fixture, acknowledgeAll } = render([alert('1'), alert('2')]);

    fixture.componentInstance.acknowledgeAllPlatformAlerts();

    expect(acknowledgeAll).toHaveBeenCalled();
    expect(fixture.componentInstance.platformAlerts).toEqual([]);
    discardPeriodicTasks();
  }));

  it('deletes one alert without touching the others', fakeAsync(() => {
    const { fixture, deleteSpy } = render([alert('1'), alert('2')]);

    fixture.componentInstance.deletePlatformAlert(alert('1'));

    expect(deleteSpy).toHaveBeenCalledWith('1');
    expect(fixture.componentInstance.platformAlerts.map((a) => a.id)).toEqual(['2']);
    discardPeriodicTasks();
  }));
});

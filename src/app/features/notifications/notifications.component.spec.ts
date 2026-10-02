import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { DeliveryStatus, TenantNotification, TenantNotificationKind } from '../../core/models/billing.model';
import { PagedResult } from '../../core/models/paged-result.model';
import { PlatformNotification } from '../../core/models/platform.model';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { NotificationsChangedService } from '../../core/services/notifications-changed.service';
import { PlatformNotificationService } from '../../core/services/platform-notification.service';
import { TenantProfileService } from '../../core/services/tenant-profile.service';
import { SharedModule } from '../../shared/shared.module';
import { NotificationsComponent } from './notifications.component';

const page = <T>(items: T[], over: Partial<PagedResult<T>> = {}): PagedResult<T> => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  ...over,
});

const tenantNotice = (over: Partial<TenantNotification> = {}): TenantNotification => ({
  id: 'n1',
  kind: TenantNotificationKind.QuotaExhausted,
  quotaType: null,
  title: 'WhatsApp quota used up',
  body: 'Sending is paused until you add credits.',
  emailStatus: DeliveryStatus.Sent,
  whatsAppStatus: DeliveryStatus.Failed,
  createdAt: '2026-10-01T10:00:00Z',
  acknowledged: false,
  ...over,
});

const platformNotice = (over: Partial<PlatformNotification> = {}): PlatformNotification => ({
  id: 'p1',
  kind: 'JobFailing',
  severity: 'Critical',
  tenantId: 't1',
  tenantName: 'Acme Traders',
  jobType: 'campaign-initial-sends',
  title: 'Campaign initial sends is failing for Acme Traders',
  body: 'Failed 3 runs in a row.',
  createdAt: '2026-10-01T10:00:00Z',
  acknowledged: false,
  ...over,
});

describe('NotificationsComponent', () => {
  let billing: jasmine.SpyObj<BillingService>;
  let platform: jasmine.SpyObj<PlatformNotificationService>;
  let changed: jasmine.SpyObj<NotificationsChangedService>;
  let router: jasmine.SpyObj<Router>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const create = (isPlatform: boolean) => {
    billing = jasmine.createSpyObj('BillingService', ['getNotificationHistory', 'acknowledgeNotification', 'acknowledgeAllNotifications', 'deleteNotification']);
    platform = jasmine.createSpyObj('PlatformNotificationService', ['getHistory', 'acknowledge', 'acknowledgeAll', 'delete']);
    changed = jasmine.createSpyObj('NotificationsChangedService', ['notify']);
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    const tenantProfile = jasmine.createSpyObj('TenantProfileService', ['getProfile']);
    tenantProfile.getProfile.and.returnValue(of({ timezone: 'Asia/Kolkata' }));

    billing.getNotificationHistory.and.returnValue(of(page([tenantNotice(), tenantNotice({ id: 'n2', acknowledged: true, title: 'Plan renewed', kind: TenantNotificationKind.CreditsAdded })])));
    platform.getHistory.and.returnValue(of(page([platformNotice()])));
    billing.acknowledgeNotification.and.returnValue(of(undefined));
    billing.acknowledgeAllNotifications.and.returnValue(of(undefined));
    billing.deleteNotification.and.returnValue(of(undefined));
    platform.acknowledge.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      declarations: [NotificationsComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: { hasAnyRole: () => isPlatform } },
        { provide: BillingService, useValue: billing },
        { provide: PlatformNotificationService, useValue: platform },
        { provide: TenantProfileService, useValue: tenantProfile },
        { provide: NotificationsChangedService, useValue: changed },
        { provide: Router, useValue: router },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    const fixture = TestBed.createComponent(NotificationsComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: { nativeElement: unknown }) => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  it("lists a tenant Admin's notifications from the billing history, with how each was delivered", () => {
    const fixture = create(false);

    expect(billing.getNotificationHistory).toHaveBeenCalledWith(jasmine.objectContaining({ page: 1 }), false);
    expect(platform.getHistory).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('WhatsApp quota used up');
    expect(text(fixture)).toContain('Email sent · WhatsApp failed');
    expect(text(fixture)).toContain('2 notifications');
  });

  it("lists the platform operator's job alerts from the platform history, with the tenant", () => {
    const fixture = create(true);

    expect(platform.getHistory).toHaveBeenCalled();
    expect(billing.getNotificationHistory).not.toHaveBeenCalled();
    expect(fixture.componentInstance.title).toBe('Platform alerts');
    expect(text(fixture)).toContain('Failed 3 runs in a row.');
    expect(text(fixture)).toContain('Acme Traders');
  });

  it('marks urgent unread rows, and dims read ones', () => {
    const fixture = create(false);
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.notification');

    expect(rows[0].classList).toContain('notification--urgent');
    expect(rows[0].classList).not.toContain('notification--read');
    expect(rows[1].classList).toContain('notification--read');
  });

  it('asks the server for only unread ones when the Unread filter is chosen, back on page one', () => {
    const fixture = create(false);

    fixture.componentInstance.setFilter('unread');

    expect(billing.getNotificationHistory.calls.mostRecent().args[1]).toBeTrue();
    expect(billing.getNotificationHistory.calls.mostRecent().args[0].page).toBe(1);
  });

  it('searches on the server after a pause', fakeAsync(() => {
    const fixture = create(false);

    fixture.componentInstance.searchControl.setValue('quota');
    tick(300);

    expect(billing.getNotificationHistory.calls.mostRecent().args[0].search).toBe('quota');
    fixture.destroy();
  }));

  it('opening an unread notification marks it read, tells the bell, and goes to where it points', () => {
    const fixture = create(false);
    const row = fixture.componentInstance.page.items[0];

    fixture.componentInstance.open(row);

    expect(billing.acknowledgeNotification).toHaveBeenCalledWith('n1');
    expect(changed.notify).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/billing/wallet');
    expect(fixture.componentInstance.page.items[0].acknowledged).toBeTrue();
  });

  it('opening a read notification only navigates', () => {
    const fixture = create(false);

    fixture.componentInstance.open(fixture.componentInstance.page.items[1]);

    expect(billing.acknowledgeNotification).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/billing/wallet');
  });

  it('a platform alert opens the background jobs screen', () => {
    const fixture = create(true);

    fixture.componentInstance.open(fixture.componentInstance.page.items[0]);

    expect(platform.acknowledge).toHaveBeenCalledWith('p1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/platform/jobs');
  });

  it('mark all as read goes through the API, tells the bell and reloads', () => {
    const fixture = create(false);
    const calls = billing.getNotificationHistory.calls.count();

    fixture.componentInstance.markAllRead();

    expect(billing.acknowledgeAllNotifications).toHaveBeenCalled();
    expect(changed.notify).toHaveBeenCalled();
    expect(billing.getNotificationHistory.calls.count()).toBe(calls + 1);
  });

  it('deleting asks first, and only deletes once confirmed', () => {
    const fixture = create(false);
    dialog.open.and.returnValue({ afterClosed: () => of(false) } as never);
    fixture.componentInstance.delete(fixture.componentInstance.page.items[0]);
    expect(billing.deleteNotification).not.toHaveBeenCalled();

    dialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
    fixture.componentInstance.delete(fixture.componentInstance.page.items[0]);
    expect(billing.deleteNotification).toHaveBeenCalledWith('n1');
    expect(changed.notify).toHaveBeenCalled();
  });

  it('says so when nothing is unread', () => {
    const fixture = create(false);
    billing.getNotificationHistory.and.returnValue(of(page<TenantNotification>([])));

    fixture.componentInstance.setFilter('unread');
    fixture.detectChanges();

    expect(text(fixture)).toContain("You're all caught up");
  });
});

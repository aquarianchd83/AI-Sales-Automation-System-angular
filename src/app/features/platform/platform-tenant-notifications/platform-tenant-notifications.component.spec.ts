import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PagedResult } from '../../../core/models/paged-result.model';
import { PlatformTenantNotification } from '../../../core/models/platform.model';
import { PlatformTenantNotificationService } from '../../../core/services/platform-tenant-notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTenantNotificationsComponent, kindLabel } from './platform-tenant-notifications.component';

const row = (over: Partial<PlatformTenantNotification>): PlatformTenantNotification => ({
  id: 'n1',
  tenantId: 't1',
  tenantName: 'Acme',
  kind: 'QuotaLow20',
  title: 'Credits running low',
  body: 'You have 20% left.',
  channel: 'Email',
  status: 'Sent',
  createdAtUtc: '2026-11-01T10:00:00Z',
  deliveryNote: null,
  acknowledgedAtUtc: null,
  ...over,
});

const kinds = ['QuotaLow20', 'NextStepBooked'];

const items = [
  row({ channel: 'InApp' }),
  row({ channel: 'Email', status: 'Sent' }),
  row({ channel: 'WhatsApp', status: 'Failed', deliveryNote: 'WhatsApp: token expired' }),
];

describe('PlatformTenantNotificationsComponent', () => {
  let fixture: ComponentFixture<PlatformTenantNotificationsComponent>;
  let root: HTMLElement;
  let getPaged: jasmine.Spy;
  let getKinds: jasmine.Spy;

  beforeEach(() => {
    getPaged = jasmine.createSpy('getPaged').and.returnValue(of({ items, totalCount: 3, page: 1, pageSize: 25 } as PagedResult<PlatformTenantNotification>));
    getKinds = jasmine.createSpy('getKinds').and.returnValue(of(kinds));
    TestBed.configureTestingModule({
      declarations: [PlatformTenantNotificationsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: PlatformTenantNotificationService, useValue: { getPaged, getKinds } }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(PlatformTenantNotificationsComponent);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  it('lists each mode with its status, and says why a delivery failed', () => {
    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row')).map((r) => (r.textContent ?? '').replace(/\s+/g, ' '));
    expect(rows.length).toBe(3);
    expect(rows[0]).toContain('In-app');
    expect(rows[0]).toContain('Not dismissed yet');
    expect(rows[2]).toContain('WhatsApp message');
    expect(rows[2]).toContain('Failed');
    expect(rows[2]).toContain('token expired');
  });

  it('asks again from the first page when the mode or status is chosen', () => {
    fixture.componentInstance.channelControl.setValue('WhatsApp');
    expect(getPaged).toHaveBeenCalledWith(jasmine.objectContaining({ channel: 'WhatsApp', page: 1 }));

    fixture.componentInstance.statusControl.setValue('Failed');
    expect(getPaged).toHaveBeenCalledWith(jasmine.objectContaining({ channel: 'WhatsApp', status: 'Failed', page: 1 }));

    fixture.componentInstance.channelControl.setValue('');
    expect(getPaged.calls.mostRecent().args[0].channel).toBeUndefined();
  });

  it('filters by the kind of notice, listing every kind by name', () => {
    expect(fixture.componentInstance.kinds.map((k) => k.value)).toEqual(['NextStepBooked', 'QuotaLow20']);

    fixture.componentInstance.kindControl.setValue('NextStepBooked');
    expect(getPaged).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'NextStepBooked', page: 1 }));
  });

  it('reads a notification kind as words', () => {
    expect(kindLabel('QuotaLow20')).toBe('Quota Low 20');
    expect(kindLabel('WhatsAppTokenFailing')).toBe('Whatsapp Token Failing');
    expect(kindLabel('NextStepBooked')).toBe('Next Step Booked');
  });
});

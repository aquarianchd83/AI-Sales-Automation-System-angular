import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { LeadDiscoverySchedule } from '../../../core/models/lead-discovery-history.model';
import { EntitlementsStore } from '../../../core/services/entitlements.store';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantJobService } from '../../../core/services/tenant-job.service';
import { SharedModule } from '../../../shared/shared.module';
import { LeadDiscoveryScheduleComponent, formatDate, parseDate } from './lead-discovery-schedule.component';

function schedule(overrides: Partial<LeadDiscoverySchedule> = {}): LeadDiscoverySchedule {
  return { timeZoneId: 'Asia/Kolkata', maxSlots: 5, slots: [], upcoming: [], nextRunAtUtc: null, ...overrides };
}

const slot = (id: string, date: string, time: string, repeatDaily = false, isDone = false) => ({
  id, date, time, repeatDaily, isDone, nextRunAtUtc: '2026-11-26T05:00:00Z', lastRunAtUtc: isDone ? '2026-11-25T08:42:00Z' : null,
});

describe('LeadDiscoveryScheduleComponent', () => {
  let fixture: ComponentFixture<LeadDiscoveryScheduleComponent>;
  let component: LeadDiscoveryScheduleComponent;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
  let jobs: jasmine.SpyObj<TenantJobService>;
  let notify: jasmine.SpyObj<NotificationService>;

  function create(initial: LeadDiscoverySchedule): void {
    service.getSchedule.and.returnValue(of(initial));
    fixture = TestBed.createComponent(LeadDiscoveryScheduleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const byId = (id: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${id}"]`);

  beforeEach(async () => {
    service = jasmine.createSpyObj('LeadDiscoveryService', ['getSchedule', 'saveSchedule']);
    jobs = jasmine.createSpyObj('TenantJobService', ['trigger']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    await TestBed.configureTestingModule({
      declarations: [LeadDiscoveryScheduleComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
        { provide: TenantJobService, useValue: jobs },
        { provide: NotificationService, useValue: notify },
        { provide: EntitlementsStore, useValue: { usedUp: () => null } },
      ],
    }).compileComponents();
  });

  it('says nothing runs by itself when there are no slots', () => {
    create(schedule());

    expect(byId('no-slots')).not.toBeNull();
    expect(byId('slot-count')?.textContent).toContain('0 / 5');
  });

  it('lists each slot and counts only the ones still to run, not a finished single run', () => {
    create(schedule({ slots: [slot('a', '2026-11-26', '10:30', true), slot('b', '2026-11-25', '14:12', false, true)] }));

    expect(byId('slot-count')?.textContent).toContain('1 / 5');
    expect(text()).toContain('Done');
    expect(component.rows.length).toBe(2);
  });

  it('stops adding at five and re-opens room when one is removed', () => {
    create(schedule());
    for (let i = 0; i < 7; i++) {
      component.add();
    }
    expect(component.rows.length).toBe(5);
    fixture.detectChanges();
    expect(byId('add-slot')?.hasAttribute('disabled')).toBeTrue();

    component.remove(0);
    fixture.detectChanges();
    expect(byId('add-slot')?.hasAttribute('disabled')).toBeFalse();
  });

  it('sends the date as the calendar day picked and the time as typed, and keeps the ids', () => {
    create(schedule({ slots: [slot('a', '2026-11-26', '10:30', true)] }));
    component.add();
    component.rows[1].date = new Date(2026, 10, 28); // 28 Nov - must not slip a day through UTC
    component.rows[1].time = '18:00';
    service.saveSchedule.and.returnValue(of(schedule({ slots: [slot('a', '2026-11-26', '10:30', true), slot('b', '2026-11-28', '18:00')] })));

    component.save();

    expect(service.saveSchedule).toHaveBeenCalledWith([
      { id: 'a', date: '2026-11-26', time: '10:30', repeatDaily: true },
      { id: null, date: '2026-11-28', time: '18:00', repeatDaily: false },
    ]);
    expect(notify.success).toHaveBeenCalled();
    expect(component.hasChanges).toBeFalse();
  });

  it('does not save a slot with no date or time, and says so', () => {
    create(schedule());
    component.add();

    component.save();

    expect(service.saveSchedule).not.toHaveBeenCalled();
    expect(component.error).toContain('Pick a date and a time');
  });

  it("shows the server's reason, such as a time in the past", () => {
    create(schedule());
    component.add();
    component.rows[0].date = new Date(2026, 0, 1);
    component.rows[0].time = '09:00';
    service.saveSchedule.and.returnValue(throwError(() => ({ error: { errors: ['Pick a date and time in the future.'] } })));

    component.save();

    expect(component.error).toBe('Pick a date and time in the future.');
  });

  it('Cancel puts the saved schedule back', () => {
    create(schedule({ slots: [slot('a', '2026-11-26', '10:30')] }));
    component.add();
    expect(component.hasChanges).toBeTrue();

    component.cancel();

    expect(component.rows.length).toBe(1);
    expect(component.hasChanges).toBeFalse();
  });

  it('Run now is its own action and queues the lead-discovery job without touching the slots', () => {
    create(schedule({ slots: [slot('a', '2026-11-26', '10:30')] }));
    jobs.trigger.and.returnValue(of({ recurringJobId: 'lead-discovery', backgroundJobId: 'j1' }));

    component.runNow();

    expect(jobs.trigger).toHaveBeenCalledWith('lead-discovery');
    expect(service.saveSchedule).not.toHaveBeenCalled();
  });

  it('turns a date into its calendar day and back without going through UTC', () => {
    expect(formatDate(new Date(2026, 10, 28))).toBe('2026-11-28');
    const back = parseDate('2026-11-28');
    expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([2026, 10, 28]);
  });
});

import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { LeadDiscoverySchedule, SaveLeadDiscoverySlot } from '../../../core/models/lead-discovery-history.model';
import { USED_UP_HINT } from '../../../core/models/wallet.model';
import { EntitlementsStore } from '../../../core/services/entitlements.store';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantJobService } from '../../../core/services/tenant-job.service';

/** One line of the form: a date picked on a calendar, a time, and whether it repeats every day. */
export interface ScheduleRow {
  id: string | null;
  date: Date | null;
  time: string;
  repeatDaily: boolean;
  /** A single run that has already happened: shown greyed, only removable. */
  isDone: boolean;
  ranAtUtc?: string | null;
}

const LEAD_DISCOVERY_JOB_TYPE = 'lead-discovery';

/**
 * The tenant's own schedule for lead discovery ("Automatically"): up to five dates and times, each picked on a calendar and a clock, once or every
 * day. Beside it, Run now ("Manually"), a separate run that never moves or uses a slot. Times are in the tenant's time zone.
 */
@Component({
  selector: 'app-lead-discovery-schedule',
  templateUrl: './lead-discovery-schedule.component.html',
  styleUrls: ['./lead-discovery-schedule.component.scss'],
})
export class LeadDiscoveryScheduleComponent implements OnInit {
  rows: ScheduleRow[] = [];
  schedule: LeadDiscoverySchedule | null = null;
  loading = true;
  loadFailed = false;
  saving = false;
  runningNow = false;
  error: string | null = null;
  readonly today = startOfToday();
  readonly usedUpHint = USED_UP_HINT;

  private saved = '';

  constructor(
    private readonly leadDiscovery: LeadDiscoveryService,
    private readonly tenantJobs: TenantJobService,
    private readonly notify: NotificationService,
    private readonly featureAccess: EntitlementsStore
  ) {}

  /** Free leads used up: the schedule stays readable, a new run needs Premium. */
  get usedUp(): boolean {
    return this.featureAccess.usedUp('LeadDiscovery') !== null;
  }

  get maxSlots(): number {
    return this.schedule?.maxSlots ?? 5;
  }

  /** Slots still to run; a finished single run does not count. */
  get activeCount(): number {
    return this.rows.filter((r) => !r.isDone).length;
  }

  get hasChanges(): boolean {
    return this.snapshot() !== this.saved;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.leadDiscovery
      .getSchedule()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (schedule) => this.apply(schedule),
        error: () => (this.loadFailed = true),
      });
  }

  add(): void {
    if (this.activeCount >= this.maxSlots) {
      return;
    }
    this.error = null;
    this.rows = [...this.rows, { id: null, date: null, time: '', repeatDaily: false, isDone: false }];
  }

  remove(index: number): void {
    this.error = null;
    this.rows = this.rows.filter((_, i) => i !== index);
  }

  cancel(): void {
    this.error = null;
    if (this.schedule) {
      this.apply(this.schedule);
    }
  }

  save(): void {
    const incomplete = this.rows.some((r) => !r.isDone && (!r.date || !r.time));
    if (incomplete) {
      this.error = 'Pick a date and a time for every slot, or remove the empty one.';
      return;
    }
    this.error = null;
    this.saving = true;
    this.leadDiscovery
      .saveSchedule(this.rows.map((r) => toRequest(r)))
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (schedule) => {
          this.apply(schedule);
          this.notify.success('Schedule saved.');
        },
        error: (err) => {
          this.error = err?.error?.errors?.[0] || err?.error?.title || err?.error?.message || 'The schedule could not be saved.';
        },
      });
  }

  runNow(): void {
    if (this.runningNow) {
      return;
    }
    this.runningNow = true;
    this.tenantJobs
      .trigger(LEAD_DISCOVERY_JOB_TYPE)
      .pipe(finalize(() => (this.runningNow = false)))
      .subscribe({
        next: () => this.notify.success('Run now queued. It is listed in history as a manual run.'),
        error: (err) => this.notify.error(err?.error?.message || err?.error?.detail || err?.error?.title || 'Lead discovery could not be queued.'),
      });
  }

  private apply(schedule: LeadDiscoverySchedule): void {
    this.schedule = schedule;
    this.rows = schedule.slots.map((s) => ({
      id: s.id,
      date: parseDate(s.date),
      time: s.time,
      repeatDaily: s.repeatDaily,
      isDone: s.isDone,
      ranAtUtc: s.lastRunAtUtc,
    }));
    this.saved = this.snapshot();
  }

  private snapshot(): string {
    return JSON.stringify(this.rows.map((r) => [r.id, r.date ? formatDate(r.date) : null, r.time, r.repeatDaily, r.isDone]));
  }
}

export function toRequest(row: ScheduleRow): SaveLeadDiscoverySlot {
  return { id: row.id, date: row.date ? formatDate(row.date) : '', time: row.time, repeatDaily: row.repeatDaily };
}

/** "2026-11-26" from a picked date, in the browser's own calendar - never through UTC, which would move the day. */
export function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { LeadFollowUp, LeadFollowUpStatus } from '../../../core/models/lead-follow-up.model';
import { LeadFollowUpService } from '../../../core/services/lead-follow-up.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { LeadFollowUpListComponent } from './lead-follow-up-list.component';

const row = (status: LeadFollowUpStatus, name: string, extra: Partial<LeadFollowUp> = {}): LeadFollowUp => ({
  id: `f-${name}`,
  leadId: `lead-${name}`,
  customerId: `c-${name}`,
  customerName: name,
  customerPhoneNumberE164: '+919000000000',
  leadStage: 'Qualified',
  status,
  dueAt: '2027-01-10T06:00:00Z',
  intervalMonths: 3,
  reason: 'Budget frozen',
  messageTemplateId: 't-1',
  messageTemplateName: 'Check in',
  followUpNumber: 1,
  sentAt: null,
  outcomeNote: null,
  createdAt: '2026-10-10T06:00:00Z',
  ...extra,
});

describe('LeadFollowUpListComponent', () => {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(items: LeadFollowUp[]) {
    const getPaged = jasmine.createSpy('getPaged').and.returnValue(of({ items, totalCount: items.length, page: 1, pageSize: 25, totalPages: 1 }));
    const getSummary = jasmine.createSpy('getSummary').and.returnValue(of({ scheduled: 4, dueNow: 1, dueWithin30Days: 2, sent: 7 }));

    TestBed.configureTestingModule({
      declarations: [LeadFollowUpListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadFollowUpService, useValue: { getPaged, getSummary } },
        { provide: NotificationService, useValue: { success: () => undefined } },
      ],
    });

    const fixture = TestBed.createComponent(LeadFollowUpListComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement, getPaged };
  }

  it('opens on the waiting follow-ups, with no status filter', () => {
    const { getPaged } = render([]);

    expect(getPaged.calls.mostRecent().args.slice(1)).toEqual([undefined, undefined]);
  });

  it('shows the header numbers', () => {
    const { root } = render([]);

    const tiles = Array.from(root.querySelectorAll('.tile')).map((t) => [text(t.querySelector('.tile-value')), text(t.querySelector('.muted'))]);
    expect(tiles).toEqual([['4', 'Waiting'], ['2', 'Due in 30 days'], ['1', 'Due now'], ['7', 'Sent so far']]);
  });

  it('narrows to what is due in 30 days, or switches to a history outcome', () => {
    const { fixture, component, getPaged } = render([]);

    component.viewControl.setValue('due30');
    fixture.detectChanges();
    expect(getPaged.calls.mostRecent().args.slice(1)).toEqual([undefined, 30]);

    component.viewControl.setValue('Sent');
    fixture.detectChanges();
    expect(getPaged.calls.mostRecent().args.slice(1)).toEqual(['Sent', undefined]);
  });

  it('offers send and cancel only where a person can still act', () => {
    const { root } = render([
      row(LeadFollowUpStatus.Scheduled, 'Asha'),
      row(LeadFollowUpStatus.Failed, 'Ravi', { outcomeNote: 'rejected' }),
      row(LeadFollowUpStatus.Sent, 'Meena'),
      row(LeadFollowUpStatus.Skipped, 'Dev', { outcomeNote: 'Customer got in touch' }),
    ]);

    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row'));
    const actions = rows.map((r) => Array.from(r.querySelectorAll('.actions-cell button')).map((b) => text(b)));

    expect(actions).toEqual([['Send now', 'Cancel'], ['Try again', 'Dismiss'], [], []]);
  });

  it('says why one was skipped', () => {
    const { root } = render([row(LeadFollowUpStatus.Skipped, 'Dev', { outcomeNote: 'Customer got in touch' })]);

    expect(text(root.querySelector('tr.mat-mdc-row'))).toContain('Customer got in touch');
  });
});

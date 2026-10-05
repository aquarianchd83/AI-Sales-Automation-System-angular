import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { LeadFollowUp, LeadFollowUpStatus } from '../../../core/models/lead-follow-up.model';
import { MessageTemplate } from '../../../core/models/message-template.model';
import { LeadFollowUpService } from '../../../core/services/lead-follow-up.service';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { LeadFollowUpPanelComponent } from './lead-follow-up-panel.component';

const followUp = (status: LeadFollowUpStatus, extra: Partial<LeadFollowUp> = {}): LeadFollowUp => ({
  id: `f-${status}-${Math.random()}`,
  leadId: 'lead-1',
  customerId: 'c-1',
  customerName: 'Asha',
  customerPhoneNumberE164: '+919000000000',
  leadStage: 'Qualified',
  status,
  dueAt: '2027-01-10T06:00:00Z',
  intervalMonths: 2,
  reason: 'Budget frozen',
  messageTemplateId: 't-1',
  messageTemplateName: 'Check in',
  followUpNumber: 1,
  sentAt: null,
  outcomeNote: null,
  createdAt: '2026-11-10T06:00:00Z',
  ...extra,
});

const template = (id: string, extra: Partial<MessageTemplate> = {}): MessageTemplate => ({
  id,
  name: `Template ${id}`,
  language: 'en',
  category: 'Marketing',
  whatsAppTemplateName: `t_${id}`,
  whatsAppTemplateStatus: 'Approved',
  bodyText: 'Hi',
  isActive: true,
  createdAt: '2026-09-01T00:00:00Z',
  metaTemplateId: null,
  headerMediaAssetId: null,
  headerOnMeta: false,
  ...extra,
});

describe('LeadFollowUpPanelComponent', () => {
  let schedule: jasmine.Spy;
  let fixture: ComponentFixture<LeadFollowUpPanelComponent>;

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(followUps: LeadFollowUp[], canEdit = true) {
    schedule = jasmine.createSpy('schedule').and.returnValue(of(followUp(LeadFollowUpStatus.Scheduled)));

    TestBed.configureTestingModule({
      declarations: [LeadFollowUpPanelComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadFollowUpService, useValue: { getForLead: () => of(followUps), schedule } },
        {
          provide: MessageTemplateService,
          useValue: {
            getPaged: () =>
              of({
                items: [
                  template('ok'),
                  template('pending', { whatsAppTemplateStatus: 'Pending' }),
                  template('retired', { isActive: false }),
                ],
                totalCount: 3,
                page: 1,
                pageSize: 100,
                totalPages: 1,
              }),
          },
        },
        { provide: NotificationService, useValue: { success: () => undefined } },
      ],
    });

    fixture = TestBed.createComponent(LeadFollowUpPanelComponent);
    fixture.componentInstance.leadId = 'lead-1';
    fixture.componentInstance.canEdit = canEdit;
    fixture.componentInstance.ngOnChanges({ leadId: { currentValue: 'lead-1', previousValue: '', firstChange: true, isFirstChange: () => true } });
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
  }

  it('offers only approved, active templates - the only kind WhatsApp lets a business start with', () => {
    const { component } = render([]);

    expect(component.templates.map((t) => t.id)).toEqual(['ok']);
    expect(component.form.controls.templateId.value).toBe('ok');
  });

  it('schedules one month by default, with the reason trimmed', () => {
    const { component } = render([]);
    component.form.patchValue({ reason: '  Budget frozen until April  ' });

    component.schedule();

    expect(schedule).toHaveBeenCalledOnceWith('lead-1', { months: 1, dueAt: null, messageTemplateId: 'ok', reason: 'Budget frozen until April' });
  });

  it('schedules 2 and 3 months from the toggle', () => {
    const { component } = render([]);

    component.form.patchValue({ choice: 3 });
    component.schedule();

    expect(schedule.calls.mostRecent().args[1].months).toBe(3);
  });

  it('needs a date before a custom follow-up can be scheduled, then sends it as the date and no months', () => {
    const { component } = render([]);
    component.form.patchValue({ choice: 'custom' });

    expect(component.canSubmit).toBeFalse();
    component.schedule();
    expect(schedule).not.toHaveBeenCalled();

    const date = new Date();
    date.setMonth(date.getMonth() + 4);
    component.form.patchValue({ date });
    expect(component.canSubmit).toBeTrue();
    component.schedule();

    const body = schedule.calls.mostRecent().args[1];
    expect(body.months).toBeNull();
    expect(body.dueAt).toBe(date.toISOString());
  });

  it('shows the waiting follow-up with its actions, and says scheduling again replaces it', () => {
    const { root } = render([followUp(LeadFollowUpStatus.Scheduled)]);

    const buttons = Array.from(root.querySelectorAll('.pending .actions button')).map((b) => text(b));
    expect(buttons).toEqual(['Send now', 'Cancel']);
    expect(text(root.querySelector('.schedule-form .field-label'))).toContain('replaces');
    expect(text(root.querySelector('.pending'))).toContain('Budget frozen');
  });

  it('stops offering another reminder once three have been sent', () => {
    const sent = [1, 2, 3].map((n) => followUp(LeadFollowUpStatus.Sent, { followUpNumber: n }));
    const { root, component } = render(sent);

    expect(component.limitReached).toBeTrue();
    expect(root.querySelector('.schedule-form')).toBeNull();
    expect(text(root.querySelector('.limit-note'))).toContain('irritate');
  });

  it('keeps the history but hides scheduling and actions on a closed lead', () => {
    const { root } = render([followUp(LeadFollowUpStatus.Scheduled), followUp(LeadFollowUpStatus.Sent)], false);

    expect(root.querySelector('.schedule-form')).toBeNull();
    expect(root.querySelector('.pending .actions')).toBeNull();
    expect(root.querySelectorAll('.history-row').length).toBe(1);
  });

  it('surfaces a failed send so it can be retried or dismissed', () => {
    const { root } = render([followUp(LeadFollowUpStatus.Failed, { outcomeNote: 'rejected' })]);

    expect(Array.from(root.querySelectorAll('.pending.failed .actions button')).map((b) => text(b))).toEqual(['Try again', 'Dismiss']);
  });
});

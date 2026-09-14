import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { PagedResult } from '../../core/models/paged-result.model';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { CampaignService } from '../../core/services/campaign.service';
import { ConversationService } from '../../core/services/conversation.service';
import { CustomerService } from '../../core/services/customer.service';
import { HandoffService } from '../../core/services/handoff.service';
import { KnowledgeBaseService } from '../../core/services/knowledge-base.service';
import { LeadService } from '../../core/services/lead.service';
import { MessageTemplateService } from '../../core/services/message-template.service';
import { TenantSettingsService } from '../../core/services/tenant-settings.service';
import { SharedModule } from '../../shared/shared.module';
import { DashboardComponent } from './dashboard.component';

function page<T>(items: T[], totalCount = items.length): Observable<PagedResult<T>> {
  return of({ items, totalCount, page: 1, pageSize: Math.max(1, items.length), totalPages: 1 });
}

const STAGE_COUNTS: Record<string, number> = {
  New: 5,
  Qualifying: 4,
  Qualified: 3,
  Negotiation: 2,
  Won: 4,
  Lost: 2,
};
const BAND_COUNTS: Record<string, number> = { Hot: 6, Warm: 8, Cold: 6 };

const conversation = {
  id: 'c1',
  customerName: 'Asha Verma',
  customerPhoneNumberE164: '+911234567890',
  status: 'Open',
  summary: 'Asked about bulk pricing',
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};
const handoff = {
  id: 'h1',
  conversationId: 'c1',
  customerName: 'Ravi Kumar',
  customerPhoneNumberE164: '+919876543210',
  triggerReason: 'CustomerRequested',
  status: 'Pending',
  createdAt: new Date().toISOString(),
};
const lead = {
  id: 'l1',
  customerName: 'Meera Shah',
  customerPhoneNumberE164: '+911111111111',
  stage: 'Negotiation',
  score: 'Hot',
  scoreNumeric: 88,
  interest: 'Annual plan',
  createdAt: new Date().toISOString(),
};
const campaigns = [
  { id: 'k1', name: 'Diwali Offer', status: 'Running', audienceCount: 120, steps: [{}, {}], createdAt: new Date().toISOString() },
  { id: 'k2', name: 'Winter Draft', status: 'Draft', audienceCount: 0, steps: [], createdAt: new Date().toISOString() },
];

interface Setup {
  admin?: boolean;
  fail?: boolean;
  empty?: boolean;
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let tenantSettings: jasmine.SpyObj<TenantSettingsService>;

  function create({ admin = true, fail = false, empty = false }: Setup = {}): string {
    const err = () => throwError(() => new Error('boom'));
    const pick = <T>(value: Observable<T>) => (fail ? err() : value);

    const customers = { getPaged: () => pick(page([], empty ? 0 : 42)) };
    const conversations = {
      getPaged: (_q: unknown, status?: string) =>
        pick(
          status === 'Open'
            ? page([], empty ? 0 : 7)
            : status === 'Escalated'
            ? page([], empty ? 0 : 2)
            : page(empty ? [] : [conversation])
        ),
    };
    const handoffs = { getPaged: () => pick(page(empty ? [] : [handoff], empty ? 0 : 3)) };
    const leads = {
      getPaged: (_q: unknown, stage?: string, score?: string) =>
        pick(
          empty
            ? page([], 0)
            : stage
            ? page([], STAGE_COUNTS[stage])
            : score
            ? page([], BAND_COUNTS[score])
            : page([lead], 20)
        ),
    };
    const campaignService = { getPaged: () => pick(page(empty ? [] : campaigns)) };
    const templates = { getPaged: () => pick(page([], 0)) };
    const knowledgeBase = { getPaged: () => pick(page([], empty ? 0 : 1)) };
    tenantSettings = jasmine.createSpyObj('TenantSettingsService', ['getUsage', 'getWhatsAppConfig']);
    tenantSettings.getUsage.and.returnValue(
      pick(of({ messagesSentThisMonth: 900, maxMessagesPerMonth: 1000 }))
    );
    tenantSettings.getWhatsAppConfig.and.returnValue(pick(of(null)));
    const billing = { getSubscription: () => pick(of(null)) };
    const auth = {
      currentUser$: of({ fullName: 'Priya Nair', roles: [admin ? 'Admin' : 'SalesAgent'] }),
      hasAnyRole: () => admin,
    };

    TestBed.configureTestingModule({
      declarations: [DashboardComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: CustomerService, useValue: customers },
        { provide: ConversationService, useValue: conversations },
        { provide: HandoffService, useValue: handoffs },
        { provide: LeadService, useValue: leads },
        { provide: CampaignService, useValue: campaignService },
        { provide: MessageTemplateService, useValue: templates },
        { provide: KnowledgeBaseService, useValue: knowledgeBase },
        { provide: TenantSettingsService, useValue: tenantSettings },
        { provide: BillingService, useValue: billing },
      ],
    });

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('greets the user and renders every widget with data', () => {
    const text = create();

    expect(text).toContain('Priya');
    // KPIs
    expect(text).toContain('42');
    expect(text).toContain('2 escalated');
    expect(text).toContain('14'); // 20 leads - 4 won - 2 lost
    expect(text).toContain('6 hot');
    expect(text).toContain('67% win rate');
    expect(text).toContain('1 running · 0 scheduled');
    // Lists
    expect(text).toContain('Asha Verma');
    expect(text).toContain('Ravi Kumar');
    expect(text).toContain('Meera Shah');
    expect(text).toContain('Diwali Offer');
    // Pipeline + temperature
    expect(text).toContain('Negotiation');
    expect(text).toContain('scored leads');
    // Alerts
    expect(text).toContain('3 customers are waiting for a human agent.');
    expect(text).toContain('WhatsApp is not connected yet');
    expect(text).toContain("90% of this month's message quota");
    // Checklist: customers, KB article and a started campaign are done; WhatsApp + template are not.
    expect(text).toContain('3 of 5 steps complete');
    // Plan & usage
    expect(text).toContain('Plan & usage');
    expect(text).toContain('Free trial');
  });

  it('hides admin-only widgets and skips their requests for a sales agent', () => {
    const text = create({ admin: false });

    expect(text).not.toContain('Plan & usage');
    expect(text).not.toContain('WhatsApp is not connected yet');
    expect(text).toContain('3 of 4 steps complete');
    expect(tenantSettings.getUsage).not.toHaveBeenCalled();
    expect(tenantSettings.getWhatsAppConfig).not.toHaveBeenCalled();
  });

  it('survives every request failing', () => {
    const text = create({ fail: true });

    expect(text).toContain('Customers');
    expect(text).toContain('—');
    expect(fixture.componentInstance.loadingOverview).toBeFalse();
    expect(fixture.componentInstance.loadingPipeline).toBeFalse();
    expect(fixture.componentInstance.loadingAccount).toBeFalse();
  });

  it('shows friendly empty states for a brand-new workspace', () => {
    const text = create({ empty: true, admin: false });

    expect(text).toContain('No conversations yet.');
    expect(text).toContain('All caught up');
    expect(text).toContain('No scored leads yet.');
    expect(text).toContain('No campaigns yet.');
    expect(text).toContain('0 of 4 steps complete');
  });
});

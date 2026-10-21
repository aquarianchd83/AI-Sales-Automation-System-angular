import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { QuotaType } from '../../../core/models/billing.model';
import { CreditScenario, TenantCreditUsage } from '../../../core/models/credit-payer.model';
import { BillingService } from '../../../core/services/billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { CreditUsageComponent } from './credit-usage.component';

const row = (overrides: Partial<TenantCreditUsage> = {}): TenantCreditUsage => ({
  id: 'u1',
  scenario: CreditScenario.CustomerChatReply,
  scenarioTitle: 'Customer chat reply',
  quotaType: QuotaType.AiConversations,
  units: 1,
  coveredByPlatform: false,
  refunded: false,
  description: 'ConversationReply',
  occurredAtUtc: '2026-10-21T04:30:00Z',
  ...overrides,
});

describe('CreditUsageComponent', () => {
  function render(rows: TenantCreditUsage[]): { element: HTMLElement; billing: jasmine.SpyObj<BillingService> } {
    const billing = jasmine.createSpyObj<BillingService>('BillingService', ['getCreditUsage']);
    billing.getCreditUsage.and.returnValue(of({ items: rows, totalCount: rows.length, page: 1, pageSize: 25, totalPages: 1 }));

    TestBed.configureTestingModule({
      declarations: [CreditUsageComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: BillingService, useValue: billing }],
    });
    const fixture = TestBed.createComponent(CreditUsageComponent);
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, billing };
  }

  it('says which actions the platform covered and which came out of the workspace balance', () => {
    const { element } = render([row({ coveredByPlatform: true }), row({ id: 'u2', scenarioTitle: 'WhatsApp template send', quotaType: QuotaType.WhatsAppMessages })]);

    expect(element.textContent).toContain('Covered by the platform');
    expect(element.textContent).toContain('Your balance');
    expect(element.textContent).toContain('WhatsApp template send');
  });

  it('marks an action whose credits were returned', () => {
    const { element } = render([row({ refunded: true })]);

    expect(element.textContent).toContain('Returned');
  });

  it('asks only for what the platform covered when filtered, including the false case', () => {
    const { billing } = render([]);
    const fixture = TestBed.createComponent(CreditUsageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onFilter(false);

    expect(billing.getCreditUsage).toHaveBeenCalledWith(jasmine.objectContaining({ coveredByPlatform: false, page: 1 }));
  });

  it('shows an empty state when nothing has used credits yet', () => {
    const { element } = render([]);

    expect(element.textContent).toContain('No credit usage yet.');
  });
});

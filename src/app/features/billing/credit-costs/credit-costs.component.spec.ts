import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { WalletSummary } from '../../../core/models/wallet.model';
import { BillingService } from '../../../core/services/billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { CreditCostsComponent } from './credit-costs.component';

const summary: WalletSummary = {
  balance: 20,
  planCode: 'premium',
  planName: 'Premium',
  monthlyCredits: 100,
  monthStartUtc: '2026-10-01T00:00:00Z',
  features: [
    {
      feature: 'WhatsAppMessaging',
      label: 'WhatsApp messaging',
      description: 'Send templates',
      includedInPlan: true,
      spentThisMonth: 0,
      monthlyCap: null,
      costs: [{ scenario: 2, title: 'WhatsApp template send', unitLabel: 'message', credits: 2, perAction: false, description: 'A billable template message.' }],
    },
    {
      feature: 'ContentStudio',
      label: 'Content Studio',
      description: 'Videos',
      includedInPlan: false,
      spentThisMonth: 0,
      monthlyCap: null,
      costs: [{ scenario: 5, title: 'Content Studio video render', unitLabel: 'video', credits: 10, perAction: false }],
    },
  ],
};

describe('CreditCostsComponent', () => {
  let fixture: ComponentFixture<CreditCostsComponent>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CreditCostsComponent],
      imports: [SharedModule, RouterTestingModule, NoopAnimationsModule],
      providers: [{ provide: BillingService, useValue: { getWallet: () => of(summary) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(CreditCostsComponent);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  it('lists every action with its price, including features outside the plan', () => {
    expect(root.querySelector('[data-testid="costs-WhatsAppMessaging"]')?.textContent).toContain('2 credits');
    const off = root.querySelector('[data-testid="costs-ContentStudio"]');
    expect(off?.textContent).toContain('10 credits');
    expect(off?.textContent).toContain('Not in your plan');
  });

  it('costs a typed quantity against the balance', () => {
    const input = root.querySelector<HTMLInputElement>('[data-testid="qty-2"]')!;
    input.value = '15';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const estimate = root.querySelector('[data-testid="costs-estimate"]')?.textContent ?? '';
    expect(estimate).toContain('30 credits');
    expect(estimate).toContain('10 credits more than your balance');
  });
});

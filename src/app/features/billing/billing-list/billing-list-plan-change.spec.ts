import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { BillingService } from '../../../core/services/billing.service';
import { EntitlementsService } from '../../../core/services/entitlements.service';
import { SharedModule } from '../../../shared/shared.module';
import { BillingListComponent } from './billing-list.component';

const plan = (id: string, price: number) => ({
  id, code: id, name: id, maxUsers: 2, maxMessagesPerMonth: 0, maxCampaigns: 2, maxKnowledgeBaseArticles: 20,
  maxLeadDiscoveryBatchSize: 25, priceMonthlyCents: price * 10, currencyCode: 'INR', currencySymbol: '₹',
  localPriceAmount: price, taxLines: [], taxLocal: 0, totalLocal: price, starterCredits: 0, monthlyCredits: 0, features: [],
});

describe('BillingListComponent changing plan', () => {
  function labels(currentPlanId: string | null): string[] {
    const billing = {
      getPlans: () => of([plan('basic', 500), plan('pro', 1500), plan('max', 3000)]),
      getSubscription: () => of(currentPlanId ? { planId: currentPlanId, planName: currentPlanId, status: 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null } : null),
      getQuota: () => of([]),
      getPaymentHistory: () => of([]),
      getCapabilities: () => of({ refundRequestsEnabled: false }),
      getRefundRequests: () => of([]),
    };
    TestBed.configureTestingModule({
      declarations: [BillingListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: BillingService, useValue: billing }],
    });
    const fixture = TestBed.createComponent(BillingListComponent);
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.plan-card button')).map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
  }

  it('offers an upgrade to a dearer plan and a downgrade to a cheaper one', () => {
    expect(labels('pro')).toEqual(['Downgrade', 'Current plan', 'Upgrade']);
  });

  it('offers only upgrades from the cheapest plan', () => {
    expect(labels('basic')).toEqual(['Current plan', 'Upgrade', 'Upgrade']);
  });

  it('says Choose plan when the tenant has no plan yet', () => {
    expect(labels(null)).toEqual(['Choose plan', 'Choose plan', 'Choose plan']);
  });

  it('treats a current plan that is not on the list (a free one) as free, so every listed plan is an upgrade', () => {
    expect(labels('trial')).toEqual(['Upgrade', 'Upgrade', 'Upgrade']);
  });

  it('reads the plan access again right after a plan change, so the menu updates at once', async () => {
    const load = jasmine.createSpy('load').and.returnValue(of(null));
    const billing = {
      getPlans: () => of([plan('basic', 500), plan('pro', 1500)]),
      getSubscription: () => of({ planId: 'basic', planName: 'basic', status: 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null }),
      getQuota: () => of([]),
      getPaymentHistory: () => of([]),
      getCapabilities: () => of({ refundRequestsEnabled: false }),
      getRefundRequests: () => of([]),
      choosePlan: () => of({ planId: 'pro', planName: 'pro', status: 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null }),
    };
    TestBed.configureTestingModule({
      declarations: [BillingListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: EntitlementsService, useValue: { load } },
      ],
    });
    const fixture = TestBed.createComponent(BillingListComponent);
    fixture.detectChanges();

    fixture.componentInstance.choosePlan(fixture.componentInstance.plans.find((p) => p.id === 'pro')!);
    fixture.detectChanges();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('mat-dialog-container button.mat-mdc-unelevated-button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(load).toHaveBeenCalledWith(true);
  });
});

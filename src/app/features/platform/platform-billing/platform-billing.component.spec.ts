import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformCreditPack, PlatformPlan } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformBillingComponent } from './platform-billing.component';

const plan = (name: string, isActive: boolean): PlatformPlan => ({
  id: name,
  code: name,
  name,
  maxUsers: 1,
  maxMessagesPerMonth: 0,
  maxCampaigns: 1,
  maxKnowledgeBaseArticles: 1,
  maxLeadDiscoveryBatchSize: 25,
  priceMonthlyCents: 0,
  isActive,
  currencyCode: 'INR',
  currencySymbol: '₹',
  priceMonthlyLocal: 100,
  starterCredits: 0,
  monthlyCredits: 0,
  features: [],
  countryPrices: [],
});

const pack = (name: string, isActive: boolean): PlatformCreditPack =>
  ({ id: name, name, quotaType: 0, units: 100, priceCents: 500, isActive, currencyCode: 'INR', currencySymbol: '₹', priceLocal: 500, countryPrices: [] }) as unknown as PlatformCreditPack;

describe('PlatformBillingComponent plan catalog', () => {
  let fixture: ComponentFixture<PlatformBillingComponent>;
  let billing: { getPlans: jasmine.Spy; getCreditPacks: jasmine.Spy; updatePlan: jasmine.Spy; updateCreditPack: jasmine.Spy; deletePlan: jasmine.Spy };

  function setup(plans: PlatformPlan[], packs: PlatformCreditPack[] = []): HTMLElement {
    billing = {
      getPlans: jasmine.createSpy('getPlans').and.returnValue(of(plans)),
      getCreditPacks: jasmine.createSpy('getCreditPacks').and.returnValue(of(packs)),
      updatePlan: jasmine.createSpy('updatePlan').and.returnValue(of(plans[0])),
      updateCreditPack: jasmine.createSpy('updateCreditPack').and.returnValue(of(packs[0])),
      deletePlan: jasmine.createSpy('deletePlan').and.returnValue(of(undefined)),
    };
    TestBed.configureTestingModule({
      declarations: [PlatformBillingComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformBillingService, useValue: billing },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(PlatformBillingComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const tileNames = (root: ParentNode) => Array.from(root.querySelectorAll('.plan-tile h3')).map((e) => e.textContent?.trim());
  const showRetiredButton = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Show retired'));

  it('lists only the active plans in the catalog', () => {
    const root = setup([plan('Trial', true), plan('Old', false), plan('Premium', true)]);

    expect(tileNames(root)).toEqual(['Trial', 'Premium']);
  });

  it('opens the retired plans in a popup from the Show retired button', async () => {
    const root = setup([plan('Trial', true), plan('Old', false), plan('Silver', false)]);

    showRetiredButton(root)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = document.querySelector('mat-dialog-container') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(tileNames(dialog)).toEqual(['Old', 'Silver']);
    expect(tileNames(root)).toEqual(['Trial']);
    document.querySelector<HTMLButtonElement>('mat-dialog-container [mat-dialog-close]')!.click();
  });

  it('hides the Show retired button when no plan is retired', () => {
    const root = setup([plan('Trial', true)]);

    expect(showRetiredButton(root)).toBeUndefined();
  });

  it('puts a retired plan back on sale with Reactivate, leaving its credits and prices alone', async () => {
    const root = setup([plan('Trial', true), plan('Old', false)]);

    showRetiredButton(root)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const reactivate = Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button')).find((b) => b.textContent?.trim() === 'Reactivate')!;
    reactivate.click();

    expect(billing.updatePlan).toHaveBeenCalledTimes(1);
    const [id, body] = billing.updatePlan.calls.mostRecent().args;
    expect(id).toBe('Old');
    expect(body.isActive).toBeTrue();
    expect(body.countryPrices).toBeUndefined();
    expect(body.features).toBeUndefined();
  });

  it('offers Retire on an active plan and not on a retired one', () => {
    const root = setup([plan('Trial', true)]);

    const labels = Array.from(root.querySelectorAll('.plan-tile-actions button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Edit', 'Retire']);
  });

  describe('credit packs', () => {
    const rows = (root: ParentNode) => Array.from(root.querySelectorAll('tr.mat-mdc-row td:first-child')).map((e) => e.textContent?.trim());
    const retiredPacksButton = (root: HTMLElement) =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.textContent?.includes('Show retired'))[0];

    it('lists only the active packs in the table', () => {
      const root = setup([plan('Trial', true)], [pack('Live', true), pack('Gone', false)]);

      expect(rows(root)).toEqual(['Live']);
    });

    it('opens the retired packs in a popup and can reactivate one', async () => {
      const root = setup([plan('Trial', true)], [pack('Live', true), pack('Gone', false)]);

      retiredPacksButton(root).click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const dialog = document.querySelector('mat-dialog-container') as HTMLElement;
      expect(rows(dialog)).toEqual(['Gone']);

      Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Reactivate')!.click();
      expect(billing.updateCreditPack).toHaveBeenCalledWith('Gone', jasmine.objectContaining({ isActive: true }));
    });
  });
});

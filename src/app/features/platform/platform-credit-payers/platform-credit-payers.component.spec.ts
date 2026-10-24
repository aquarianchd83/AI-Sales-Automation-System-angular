import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { QuotaType } from '../../../core/models/billing.model';
import {
  CreditPayer,
  CreditScenario,
  CreditScenarioInfo,
  CreditUsage,
  CreditUsageStatus,
  PlatformCreditEntry,
  canRedeem,
} from '../../../core/models/credit-payer.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformCreditPayerService } from '../../../core/services/platform-credit-payer.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformCreditPayersComponent } from './platform-credit-payers.component';

const chat: CreditScenarioInfo = {
  scenario: CreditScenario.CustomerChatReply,
  title: 'Customer chat reply',
  area: 'Customer chat',
  description: 'The AI answering a customer in WhatsApp.',
  quotaType: QuotaType.AiConversations,
  payer: CreditPayer.Tenant,
  defaultPayer: CreditPayer.Tenant,
  unitsConfigurable: false,
  unitsPerAction: 1,
  unitLabel: 'reply',
  platformBalance: 0,
  actionsLast30Days: 12,
  unitsChargedToPlatformLast30Days: 0,
  unitsChargedToTenantsLast30Days: 12,
  fallbackCountLast30Days: 0,
  providerCostLast30DaysUsd: 0.0421,
  changedAtUtc: null,
};

const knowledge: CreditScenarioInfo = {
  ...chat,
  scenario: CreditScenario.ProductKnowledgeReading,
  title: 'Product knowledge: reading sources',
  area: 'Product knowledge',
  payer: CreditPayer.Platform,
  defaultPayer: CreditPayer.Platform,
  unitsConfigurable: true,
  unitsPerAction: 0,
  actionsLast30Days: 0,
  unitsChargedToTenantsLast30Days: 0,
  providerCostLast30DaysUsd: null,
};

const usage = (overrides: Partial<CreditUsage> = {}): CreditUsage => ({
  id: 'u1',
  tenantId: 't1',
  tenantName: 'SunVolt Energy',
  scenario: CreditScenario.CustomerChatReply,
  scenarioTitle: 'Customer chat reply',
  quotaType: QuotaType.AiConversations,
  units: 1,
  configuredPayer: CreditPayer.Tenant,
  chargedTo: CreditPayer.Tenant,
  fellBackToTenant: false,
  status: CreditUsageStatus.Charged,
  description: 'ConversationReply',
  referenceType: 'AiTransaction',
  referenceId: 'x',
  // No trailing Z would be read as local time by a browser; the API sends one and the zonedDate pipe renders it in the viewer's zone.
  occurredAtUtc: '2026-10-21T04:30:00Z',
  settledAtUtc: null,
  settlementNote: null,
  ...overrides,
});

describe('PlatformCreditPayersComponent', () => {
  let fixture: ComponentFixture<PlatformCreditPayersComponent>;
  let service: jasmine.SpyObj<PlatformCreditPayerService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(scenarios: CreditScenarioInfo[], rows: CreditUsage[] = []): void {
    service.getScenarios.and.returnValue(of(scenarios));
    service.getWallets.and.returnValue(of([{ quotaType: QuotaType.AiConversations, balance: 0 }]));
    service.getUsage.and.returnValue(of({ items: rows, totalCount: rows.length, page: 1, pageSize: 25, totalPages: 1 }));
    service.getWalletLedger.and.returnValue(of(emptyPage<PlatformCreditEntry>()));
    fixture = TestBed.createComponent(PlatformCreditPayersComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('PlatformCreditPayerService', ['getScenarios', 'setPayer', 'getWallets', 'adjustWallet', 'getWalletLedger', 'getUsage', 'redeem']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    TestBed.configureTestingModule({
      declarations: [PlatformCreditPayersComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformCreditPayerService, useValue: service },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    }).overrideProvider(MatDialog, { useValue: dialog });
  });

  /** Only the open tab is rendered: 0 Prices, 1 Who pays, 2 Activity, 3 Platform wallet. */
  async function openTab(index: number): Promise<void> {
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.mat-mdc-tab')[index].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('lists every action with its editable price on the Prices tab', () => {
    create([chat, knowledge]);

    expect(text()).toContain('Customer chat reply');
    expect(text()).toContain('Product knowledge: reading sources');
    expect(text()).toContain('Free - nobody is charged.');
  });

  it('lists every scenario with who pays and what it did over the last 30 days', async () => {
    create([chat, knowledge]);
    await openTab(1);

    expect(text()).toContain('Customer chat reply');
    expect(text()).toContain('12 actions');
  });

  it('warns when a scenario is set to the platform but its wallet is empty', async () => {
    create([{ ...chat, payer: CreditPayer.Platform, platformBalance: 0 }]);
    await openTab(1);

    expect(text()).toContain('Platform wallet is empty');
  });

  it('does not warn when the platform wallet can cover the scenario', async () => {
    create([{ ...chat, payer: CreditPayer.Platform, platformBalance: 25 }]);
    await openTab(1);

    expect(text()).not.toContain('Platform wallet is empty');
  });

  it('asks before switching the payer, then saves it', () => {
    create([chat]);
    dialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
    service.setPayer.and.returnValue(of({ ...chat, payer: CreditPayer.Platform }));

    fixture.componentInstance.changePayer(chat, CreditPayer.Platform);

    expect(dialog.open).toHaveBeenCalled();
    expect(service.setPayer).toHaveBeenCalledWith(CreditScenario.CustomerChatReply, { payer: CreditPayer.Platform, unitsPerAction: 1 });
    expect(fixture.componentInstance.scenarios[0].payer).toBe(CreditPayer.Platform);
  });

  it('does not switch the payer when the admin cancels', () => {
    create([chat]);
    dialog.open.and.returnValue({ afterClosed: () => of(false) } as never);

    fixture.componentInstance.changePayer(chat, CreditPayer.Platform);

    expect(service.setPayer).not.toHaveBeenCalled();
  });

  it('saves credits per action for a scenario the platform prices', () => {
    create([knowledge]);
    service.setPayer.and.returnValue(of({ ...knowledge, unitsPerAction: 2 }));

    fixture.componentInstance.setDraftUnits(knowledge, '2');
    expect(fixture.componentInstance.unitsChanged(knowledge)).toBeTrue();
    fixture.componentInstance.saveUnits(knowledge);

    expect(service.setPayer).toHaveBeenCalledWith(CreditScenario.ProductKnowledgeReading, { payer: CreditPayer.Platform, unitsPerAction: 2 });
  });

  it('refuses a negative or blank credits-per-action value', () => {
    create([knowledge]);

    fixture.componentInstance.setDraftUnits(knowledge, '-1');
    expect(fixture.componentInstance.unitsValid(knowledge)).toBeFalse();
    fixture.componentInstance.setDraftUnits(knowledge, '');
    expect(fixture.componentInstance.unitsValid(knowledge)).toBeFalse();
  });

  it('shows who paid for each spend, and flags the ones where the tenant paid because the platform wallet was empty', async () => {
    create([chat], [usage({ configuredPayer: CreditPayer.Platform, fellBackToTenant: true })]);

    await openTab(2);

    expect(text()).toContain('SunVolt Energy');
    expect(text()).toContain('Platform wallet was empty');
  });

  it('only offers to give credits back for a charged, tenant-paid spend', () => {
    expect(canRedeem(usage())).toBeTrue();
    expect(canRedeem(usage({ chargedTo: CreditPayer.Platform }))).toBeFalse();
    expect(canRedeem(usage({ status: CreditUsageStatus.Redeemed }))).toBeFalse();
    expect(canRedeem(usage({ units: 0 }))).toBeFalse();
  });
});

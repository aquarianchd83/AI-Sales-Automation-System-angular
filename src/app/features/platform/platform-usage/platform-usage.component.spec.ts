import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformTenantUsage } from '../../../core/models/platform.model';
import { PlatformUsageService } from '../../../core/services/platform-usage.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformUsageComponent } from './platform-usage.component';

const row: PlatformTenantUsage = {
  tenantId: 't1',
  tenantName: 'SunVolt Energy',
  messagesSentThisMonth: 420,
  messageLimit: 1000,
  messageQuotaBreached: false,
  userCount: 4,
  userLimit: 10,
  userQuotaBreached: false,
  aiInteractionsThisMonth: 96,
  estimatedAiSpendThisMonthUsd: 0.1234,
  billableWhatsAppMessagesThisMonth: 130,
  estimatedWhatsAppSpendThisMonthUsd: 1.287,
  leadDiscoveryRunsThisMonth: 2,
  leadDiscoveryLeadsThisMonth: 30,
  // Deliberately not sitting on a half-cent boundary: 0.845 is held as 0.84499… by a double, so it
  // renders "$0.84" and the test would be about floating point rather than about the column.
  estimatedLeadDiscoverySpendThisMonthUsd: 0.8452,
  estimatedTotalSpendThisMonthUsd: 2.2556,
  // 1 Sep 00:00 IST — a tenant in Asia/Kolkata starts its month 5.5 hours before UTC does.
  spendPeriodStartUtc: '2026-08-31T18:30:00Z',
};

describe('PlatformUsageComponent', () => {
  let fixture: ComponentFixture<PlatformUsageComponent>;
  let service: jasmine.SpyObj<PlatformUsageService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(usage: PlatformTenantUsage): void {
    service.getPaged.and.returnValue(of({ items: [usage], totalCount: 1, page: 1, pageSize: 25, totalPages: 1 }));
    fixture = TestBed.createComponent(PlatformUsageComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('PlatformUsageService', ['getPaged']);

    TestBed.configureTestingModule({
      declarations: [PlatformUsageComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: PlatformUsageService, useValue: service }],
    });
  });

  it('shows per-tenant WhatsApp, lead discovery and total spend beside the quotas', () => {
    create(row);

    expect(text()).toContain('SunVolt Energy');
    expect(text()).toContain('420 / 1000');
    expect(text()).toContain('130 billable');
    expect(text()).toContain('$1.29'); // WhatsApp
    expect(text()).toContain('2 runs');
    expect(text()).toContain('$0.85'); // lead discovery
    expect(text()).toContain('$2.26'); // total
    expect(text()).toContain('Spend is estimated from hand-maintained list prices');
  });

  it('keeps a sub-cent estimate visible rather than rounding it to zero', () => {
    create({ ...row, estimatedAiSpendThisMonthUsd: 0.0034, estimatedTotalSpendThisMonthUsd: 0.0034 });

    expect(text()).toContain('$0.0034');
    expect(text()).not.toContain('$0.00 ');
  });
});

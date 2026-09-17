import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { TenantCharges } from '../../../core/models/tenant-settings.model';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { TenantSettingsListComponent } from './tenant-settings-list.component';

const charges: TenantCharges = {
  currencyCode: 'USD',
  currencySymbol: '$',
  periodStartUtc: '2026-09-01T00:00:00Z',
  whatsApp: {
    messagesSent: 120,
    billableMessages: 30,
    freeMessages: 90,
    estimatedCostUsd: 0.402,
    estimatedCostLocal: 0.402,
    byCategory: [
      { category: 'Marketing', messages: 20, ratePerMessageUsd: 0.015, estimatedCostUsd: 0.3, estimatedCostLocal: 0.3 },
      { category: 'Utility', messages: 10, ratePerMessageUsd: 0.0102, estimatedCostUsd: 0.102, estimatedCostLocal: 0.102 },
    ],
  },
  leadDiscovery: { runs: 3, leadsSaved: 41, estimatedCostUsd: 1.25, estimatedCostLocal: 1.25 },
  totalEstimatedCostUsd: 1.652,
  totalEstimatedCostLocal: 1.652,
};

describe('TenantSettingsListComponent', () => {
  let fixture: ComponentFixture<TenantSettingsListComponent>;
  let service: jasmine.SpyObj<TenantSettingsService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(): void {
    fixture = TestBed.createComponent(TenantSettingsListComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('TenantSettingsService', ['getWhatsAppConfig', 'getUsage', 'getCharges']);
    service.getWhatsAppConfig.and.returnValue(of(null));
    service.getUsage.and.returnValue(of({ messagesSentThisMonth: 120, maxMessagesPerMonth: 1000 }));
    service.getCharges.and.returnValue(of(charges));

    TestBed.configureTestingModule({
      declarations: [TenantSettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: TenantSettingsService, useValue: service }],
    });
  });

  it('shows WhatsApp and lead discovery charges with a total', () => {
    create();

    expect(text()).toContain('30 billable of 120 messages');
    expect(text()).toContain('$0.40');
    expect(text()).toContain('Marketing · 20');
    expect(text()).toContain('3 runs ·');
    expect(text()).toContain('41 leads');
    expect(text()).toContain('$1.25');
    expect(text()).toContain('$1.65');
    expect(text()).toContain('your provider invoices are the authority');
  });

  it('keeps four decimals below a unit, so a fraction of a cent is not shown as zero', () => {
    service.getCharges.and.returnValue(
      of({
        ...charges,
        whatsApp: { ...charges.whatsApp, estimatedCostLocal: 0.0072, byCategory: [] },
        leadDiscovery: { ...charges.leadDiscovery, runs: 0, leadsSaved: 0, estimatedCostLocal: 0 },
        totalEstimatedCostLocal: 0.0072,
      })
    );
    create();

    expect(text()).toContain('$0.0072');
    expect(text()).toContain('Replies inside an open conversation are free.');
  });

  it('says so when charges cannot be loaded, without breaking the rest of the page', () => {
    service.getCharges.and.returnValue(throwError(() => new Error('boom')));
    create();

    expect(text()).toContain("We couldn't load your charges right now.");
    expect(text()).toContain('Usage this month');
  });
});

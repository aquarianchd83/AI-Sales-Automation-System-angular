import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { BillingService } from '../../../core/services/billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { CreditUsageComponent } from './credit-usage.component';

describe('CreditUsageComponent', () => {
  function render(): { element: HTMLElement; billing: jasmine.SpyObj<BillingService> } {
    const billing = jasmine.createSpyObj<BillingService>('BillingService', ['getLedger', 'getLedgerSummary']);
    billing.getLedger.and.returnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 }));
    billing.getLedgerSummary.and.returnValue(of({ totalEntries: 0, byEntryType: [], byFeature: [], daily: [] }));

    TestBed.configureTestingModule({
      declarations: [CreditUsageComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: BillingService, useValue: billing }],
    });
    const fixture = TestBed.createComponent(CreditUsageComponent);
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, billing };
  }

  it('shows this workspace\'s own credit history - tiles, graph and the date filter', () => {
    const { element, billing } = render();

    expect(element.querySelector('app-credit-history')).toBeTruthy();
    expect(element.textContent).toContain('Filter');
    expect(billing.getLedger).toHaveBeenCalled();
    expect(billing.getLedgerSummary.calls.mostRecent().args[0]).toBe(30);
  });

  it('no longer has the separate spend list (the "Show" filter and the When / What / Paid by table)', () => {
    const { element } = render();

    expect(element.querySelector('table[mat-table] th')?.textContent).not.toContain('When');
    expect(element.textContent).not.toContain('Paid by');
    expect(element.textContent).not.toContain('Covered by the platform');
  });
});
